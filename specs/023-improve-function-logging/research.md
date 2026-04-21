# Research: Improve Inngest Function Logging

**Feature**: 023-improve-function-logging  
**Date**: 2026-04-20

## Decision 1: Run Correlation Strategy — AsyncLocalStorage

**Decision**: Use Node.js built-in `AsyncLocalStorage` (from `node:async_hooks`) to store `{ runId, clientId }` at the start of each Inngest function invocation. The `log()` and `logError()` utilities in `src/utils/logger.ts` will read from this store automatically on every call.

**Rationale**: AsyncLocalStorage propagates context through the entire async call chain without explicit parameter threading. This means helper functions in `src/lib/` (analytics, sheets, email) automatically include `runId` and `clientId` in their log entries with no signature changes.

**Alternatives considered**:
- *Pass `runId` as an explicit parameter* — works but pollutes every helper function signature and is easy to forget.
- *Use a module-level global variable* — simpler but not safe under concurrent Inngest invocations running in the same Node.js process, which would cause `runId` values to bleed across runs.
- *Use Inngest's built-in `logger`* — Inngest v3 exposes a `logger` in the function context, but it doesn't integrate with the existing `pino`-based `log()` utility or Better Stack transport. Replacing it would be a larger change.

**AsyncLocalStorage availability**: Available since Node.js 12.17.0 LTS; stable in Node.js 20. No package installation required — import from `node:async_hooks`.

---

## Decision 2: Inngest `runId` Availability

**Decision**: Destructure `runId` directly from the Inngest function handler context object.

**Rationale**: Confirmed from `node_modules/inngest/types.d.ts` — `runId: string` is a top-level field on the handler context alongside `event`, `step`, and `attempt`. It is unique per function invocation and visible in the Inngest Dev UI and dashboard, making it the ideal correlation key.

**Usage**:
```ts
async ({ event, step, runId }) => {
  setRunContext({ runId, clientId });
  // ...
}
```

**Scheduler functions** (weekly/monthly) do not have a `clientId` at the top level — they set `setRunContext({ runId })` and each fan-out child invocation sets its own context when it starts.

---

## Decision 3: Scope of Log Changes

**Decision**: Update all log call sites across 4 Inngest function files and 3 lib files. Also update `template.ts` to establish the new style as the canonical pattern.

**Files in scope**:

| File | Log calls | Changes |
|------|-----------|---------|
| `src/utils/logger.ts` | — | Add `AsyncLocalStorage`, `setRunContext()`, auto-merge context |
| `src/inngest/functions/form-notification.ts` | 3 | Add `setRunContext()`; rewrite messages |
| `src/inngest/functions/analytics-report.ts` | 4 | Add `setRunContext()`; rewrite messages |
| `src/inngest/functions/weekly-analytics-scheduler.ts` | 4 | Add `setRunContext()`; rewrite messages |
| `src/inngest/functions/monthly-analytics-scheduler.ts` | 4 | Add `setRunContext()`; rewrite messages |
| `src/inngest/functions/template.ts` | 2 | Update as canonical example |
| `src/lib/analytics.ts` | 1 existing + 1 new | Add pre-query boundary log |
| `src/lib/sheets.ts` | 1 existing + 1 new | Add pre-append boundary log; improve success log |
| `src/lib/email.ts` | 4 existing | Add pre-send boundary log for live/test paths |

**Files intentionally out of scope**:
- `src/lib/templates.ts` — error-only logs for chart rendering failures; these are appropriate as-is and not action boundaries
- `src/lib/db.ts` — no log calls; DB errors surface through Inngest step retries

---

## Decision 4: `setRunContext` API Design

**Decision**:
```ts
interface RunContext {
  runId: string;
  clientId?: string;
}

const storage = new AsyncLocalStorage<RunContext>();

export function setRunContext(ctx: RunContext): void {
  // Called once per Inngest function invocation, wraps nothing —
  // Inngest's step runner already manages the async context chain
}
```

**Key constraint**: `AsyncLocalStorage.run()` wraps a callback and propagates context to all async operations within it. However, Inngest's step execution model re-enters the function handler on each step — the context store must be seeded at the top of each handler invocation (before any `await`), not wrapped around a callback.

**Solution**: Use `storage.enterWith(ctx)` which sets the store for the current async context and all continuations without requiring a wrapper callback. This is the correct pattern for Inngest where the runtime (not our code) manages the outer async boundary.

`enterWith` is available in Node.js 16+ and is the standard approach for middleware-style context injection (used by OpenTelemetry, Next.js request context, etc.).
