# Tasks: Improve Inngest Function Logging

**Input**: Design documents from `/specs/023-improve-function-logging/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. Phase 2 (logger foundation) MUST complete before all story phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to

---

## Phase 1: Setup

No project initialization required — this feature modifies existing files only.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Add `AsyncLocalStorage` run-context to `logger.ts`. Every subsequent task depends on this being in place.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Update `src/utils/logger.ts` — import `AsyncLocalStorage` from `node:async_hooks`; define `RunContext` interface `{ runId: string; clientId?: string }`; create `storage = new AsyncLocalStorage<RunContext>()`; export `setRunContext(ctx: RunContext): void` using `storage.enterWith(ctx)`; update `log()` and `logError()` to spread `storage.getStore() ?? {}` into the pino context object on every call

**Checkpoint**: `setRunContext`, `log`, and `logError` are all exported. Every `log()` call now auto-includes `runId` and `clientId` from the active async context.

---

## Phase 3: User Story 1 — Follow Workflow Execution in Logs (Priority: P1) 🎯 MVP

**Goal**: Every Inngest function emits plain-English log messages with key values (clientId, emails, property IDs, date ranges) embedded inline, so a developer can read the log stream and understand exactly what happened without opening source code.

**Independent Test**: Run `npm run dev`, trigger each function from the Inngest Dev UI, and read the terminal log output. Each line should be a self-explanatory sentence — no JSON-only context blobs, no generic "Workflow started" messages.

- [x] T002 [P] [US1] Update `src/inngest/functions/form-notification.ts` — destructure `runId` from handler context; call `setRunContext({ runId, clientId })` before any steps; rewrite log messages: `"form/submitted received for client {clientId}"` at start, `"Sending form notification email to {recipients}"` before send step, `"Form notification sent to {recipients} — outcome: {outcome}"` at completion, `"Form notification skipped for client {clientId} — {reason}"` when email skipped
- [x] T003 [P] [US1] Update `src/inngest/functions/analytics-report.ts` — destructure `runId` from handler context; call `setRunContext({ runId, clientId })` before any steps; rewrite log messages: `"Analytics report started for client {clientId} — period: {preset} ({label})"` after period resolved, `"Querying GA4 property {propertyId} for client {clientId}"` before fetch-analytics-data step, `"Sending analytics report email to {recipients}"` before send-email step, `"Analytics report sent to {recipients} — outcome: {outcome}"` at completion; replace `"Resolving send time"` with `"Resolving delivery window for client {clientId} — timezone: {tz}"`; replace the 7-iteration-fallback log with `"No valid business day found in 7 days for client {clientId} — sending immediately"`
- [x] T004 [P] [US1] Update `src/inngest/functions/weekly-analytics-scheduler.ts` — destructure `runId` from handler context; call `setRunContext({ runId })` at start (no clientId at scheduler level); rewrite log messages: `"Weekly analytics scheduler triggered — env: {env}"` at start, `"Fetched {n} active client(s) — dispatching reports"` after fetch, `"No active clients found — skipping weekly fan-out"` when empty, `"Dispatched weekly analytics report for client {clientId} ({i} of {n})"` per-client dispatch (requires iterating `clients` alongside `ids` to log per-client) OR `"Dispatched {n} weekly analytics report event(s)"` as a summary if individual dispatch logging is not feasible within `step.sendEvent`
- [x] T005 [P] [US1] Update `src/inngest/functions/monthly-analytics-scheduler.ts` — same pattern as T004 but for monthly: `"Monthly analytics scheduler triggered — env: {env}"`, `"Fetched {n} active client(s) — dispatching monthly reports"`, `"No active clients found — skipping monthly fan-out"`, `"Dispatched {n} monthly analytics report event(s)"`

**Checkpoint**: All 4 Inngest function files produce plain-English log output. Run `npm run dev` and trigger any function — log lines should read as a narrative.

---

## Phase 4: User Story 2 — Retain Structured Filtering Capability (Priority: P2)

**Goal**: Confirm that `clientId` and `runId` appear as structured fields on every log entry emitted during a function run, enabling log-aggregation filtering in Better Stack.

**Independent Test**: Inspect pino JSON output (dev mode pretty-prints this) for any log line emitted inside a function invocation — it must include `runId` and `clientId` as top-level JSON fields alongside `msg`.

- [x] T006 [US2] Audit all `log()` call sites updated in T002–T005 — confirm each function calls `setRunContext({ runId, clientId })` before its first log; confirm no call site passes an explicit `clientId` in the context object that would conflict with the auto-merged value; remove any now-redundant explicit `clientId` from context objects since it is provided automatically via `AsyncLocalStorage`; also confirm scheduler functions (`weekly`, `monthly`) pass at minimum `{ runId }` so all their log lines carry the run correlation ID

**Checkpoint**: Every log line for a function invocation carries `runId` (all functions) and `clientId` (per-client functions) as structured fields, verifiable in pino JSON output.

---

## Phase 5: User Story 3 — Action Boundary Logs in Helper Functions (Priority: P3)

**Goal**: Each significant external I/O call in `lib/` is preceded by a log line naming the target resource, so a developer can see exactly which step failed when debugging mid-step errors.

**Independent Test**: Trigger the full `send-analytics-report` function and verify the log stream shows: a pre-GA4-query log, a pre-email-send log, and (if sheets is configured) a pre-append log — all carrying `runId` and `clientId` automatically from `AsyncLocalStorage`.

- [x] T007 [P] [US3] Update `src/lib/analytics.ts` — add `log("Querying GA4 property {propertyId} for period {start} – {end}")` immediately before the `Promise.all([...])` GA4 API calls in `getAnalyticsReport()`; keep the existing mock-data fallback log and rewrite it as `"GA4 not configured for property {propertyId} — returning mock data"`
- [x] T008 [P] [US3] Update `src/lib/sheets.ts` — add `log("Appending row to sheet {spreadsheetId} — range: {range}")` immediately before the `fetch(url, ...)` call in `appendSheetRow()`; rewrite the existing success log from `"[sheets] Row appended"` to `"Row appended to sheet {spreadsheetId} — {rowsAppended} row(s) written"`; rewrite the existing error log from `"[sheets] Failed to append row"` to `"Failed to append row to sheet {spreadsheetId}: {message}"`
- [x] T009 [P] [US3] Update `src/lib/email.ts` — add `log("Sending email to {toLabel} — subject: {subject}")` immediately before the `resend.emails.send(...)` call in the live/test code path; the mock and mailtrap paths already log what they would send so they only need their messages cleaned of the `[mock]`/`[mailtrap]` prefixes and rewritten as plain-English: `"Mock email to {toLabel} — subject: {subject}"`, `"Mailtrap email sent to {toLabel} — subject: {subject}"`

**Checkpoint**: Trigger a full analytics report run — log output shows pre-query, pre-send, and (if applicable) pre-append lines, all with `runId`/`clientId` from the async context.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T010 Update `src/inngest/functions/template.ts` — add `runId` to handler destructuring, add `setRunContext({ runId, clientId })` call, rewrite the two placeholder log messages to match the new plain-English style so the template serves as a canonical example for future functions
- [x] T011 Run `npm run type-check` — resolve any TypeScript errors introduced by the new `RunContext` type or `setRunContext` import across all modified files
- [ ] T012 Manual smoke test — run `npm run dev`, trigger `form/submitted` and `analytics/weekly.scheduled` events from the Inngest Dev UI, and confirm: (1) every log line is a readable sentence, (2) `runId` and `clientId` appear as structured fields in the pino JSON output, (3) no regressions in function behaviour

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — start immediately
- **Phase 3 (US1)**: Depends on T001 — all 4 tasks can then run in parallel
- **Phase 4 (US2)**: Depends on T002–T005 completing — single audit/verification task
- **Phase 5 (US3)**: Depends on T001 only — can run in parallel with Phase 3 if desired
- **Phase 6 (Polish)**: Depends on all prior phases completing

### User Story Dependencies

- **US1 (P1)**: Unblocked after T001 — T002/T003/T004/T005 are fully parallel
- **US2 (P2)**: Depends on US1 completing — T006 is a cross-file audit
- **US3 (P3)**: Depends on T001 only — T007/T008/T009 are fully parallel and can overlap with US1

### Parallel Opportunities

- T002, T003, T004, T005 are all different files with no shared state → run in parallel
- T007, T008, T009 are all different files → run in parallel (and can overlap with Phase 3)

---

## Parallel Example: Phase 3 (US1)

```text
After T001 completes, launch all four simultaneously:

Task T002: form-notification.ts — setRunContext + rewrite messages
Task T003: analytics-report.ts  — setRunContext + rewrite messages
Task T004: weekly-analytics-scheduler.ts — setRunContext + rewrite messages
Task T005: monthly-analytics-scheduler.ts — setRunContext + rewrite messages
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 2: T001 — logger foundation
2. Complete Phase 3: T002–T005 — rewrite function messages
3. **STOP and VALIDATE**: Run dev server, trigger a function, read the logs
4. Plain-English narrative confirmed → US1 done

### Full Delivery

1. Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
2. Each phase independently testable before moving forward

---

## Notes

- `enterWith()` is the correct `AsyncLocalStorage` API here (not `.run()`) — Inngest re-enters the handler on each step execution so context must be seeded at the top of the handler, not wrapped in a callback. See `research.md` Decision 4.
- Scheduler functions (`weekly`, `monthly`) do not have a `clientId` at the top level — they call `setRunContext({ runId })` only. Per-client log correlation happens in the child `analytics-report` invocations.
- Remove `as any` casts on `log()` context objects where they were added to suppress TypeScript errors about `env` — the new `RunContext` type should be broadened to `{ runId?: string; clientId?: string; [key: string]: unknown }` if needed to accommodate ad-hoc context fields.
