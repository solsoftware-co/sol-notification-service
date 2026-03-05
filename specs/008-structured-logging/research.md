# Research: Structured Logging with Pino + Better Stack

**Feature**: 008-structured-logging
**Date**: 2026-03-05
**Revised**: 2026-03-05 — switched platform from Axiom to Better Stack; incorporated 5 correctness fixes

---

## Decision 1: Logging Library — Pino

**Decision**: Use `pino` as the structured logging library.

**Rationale**: Pino is the fastest structured logger in the Node.js ecosystem, benchmarked at 5–8x faster than winston and bunyan. It uses a worker-thread-based transport model (since v7) that keeps log serialization off the main event loop. It has native TypeScript types, excellent ecosystem support, and a first-party Better Stack transport. It emits JSON by default — exactly what Better Stack's ingest expects.

**Alternatives considered**:
- `winston` — popular but significantly slower than pino; no native multi-transport worker-thread model
- `bunyan` — largely unmaintained since 2020; no active ecosystem
- Custom JSON wrapper over `console.log` — zero dependencies but no async transport, no level filtering, no worker-thread isolation, would require building what pino provides out of the box

---

## Decision 2: Log Management Platform — Better Stack

**Decision**: Use Better Stack (Logtail) as the centralized log management platform.

**Rationale**: At this service's scale (< 1 MB/month log volume), all platforms with a free tier are effectively free forever — the raw ingest limit difference between platforms is irrelevant. Better Stack wins on the axes that actually matter at this scale:

- **SQL queries** — you already know SQL; APL (Axiom's query language) adds a learning curve with zero payoff here
- **Built-in uptime monitoring** — consolidates an additional tool into one platform
- **Mature alerting** — full alerting + on-call routing; important for getting paged when a workflow errors in production
- **Official Pino transport** — `@logtail/pino` is first-party and actively maintained

**Free tier limits (current)**:
| Limit | Value |
|---|---|
| Ingest | 1 GB / month |
| Retention | 30 days |
| Uptime monitors | Included |
| Alerting | Included |
| Team members | Unlimited |

At estimated < 1 MB/month, this is 1,000x headroom on the free tier.

**Alternatives considered**:
- **Axiom**: 500 GB/month free ingest — far more generous in raw volume, but APL query language has a learning curve and no built-in uptime monitoring; free tier size advantage is irrelevant at current scale
- **Grafana Cloud (Loki)**: Generous free tier but LogQL query model and DX are more complex
- **Datadog**: No meaningful free tier for log management
- **New Relic**: Free tier exists but DX is more complex
- **Self-hosted ELK (Elasticsearch + Kibana)**: Violates the constitution's no-Docker/no-local-infrastructure rule

---

## Decision 3: Better Stack Transport Package — `@logtail/pino`

**Decision**: Use `@logtail/pino` (the official Better Stack transport for Pino).

**Package**: `@logtail/pino`
**Install**: `npm install @logtail/pino`

**Required environment variable**:
- `LOGTAIL_SOURCE_TOKEN` — a Better Stack source token. Created when you add a new "Source" in the Better Stack dashboard. Unlike API keys, source tokens are ingest-only by design.

**Transport configuration**:
```
target: '@logtail/pino'
options: { sourceToken: config.logtailToken }
```

Note: `sourceToken` is read from `config.logtailToken` (the `config.ts` singleton), never directly from `process.env`. See Decision 10 (config.ts integration).

**Known caveat — bundlers**: If the project ever introduces a bundler (esbuild, Vite, Turbopack), `@logtail/pino`, `pino`, and `thread-stream` must be marked as external so the bundler doesn't strip the CJS resolution path that Pino's worker-thread transport requires. The current `tsc` + `tsx` build chain does not bundle, so this caveat does not apply.

**Known caveat — graceful shutdown**: Pino's worker-thread transport is async. At SIGTERM, in-flight log batches may not have flushed to Better Stack yet. See Decision 9 for the flush export pattern.

---

## Decision 4: Dev Pretty-Printing — `pino-pretty`

**Decision**: Use `pino-pretty` as a `devDependency` for human-readable terminal output in local development.

**Install**: `npm install --save-dev pino-pretty`

**Pattern**: Include `pino-pretty` in the transport `targets` array only when `config.env === 'development'`. When the condition is false, the module is never required, so its absence in production `node_modules` causes no error.

**pino-pretty v10+ note**: Since v10, pino-pretty is ESM-only. It must be used via Pino's `transport()` API (worker thread), not via `require('pino-pretty')` directly. Using it as a transport `target` string handles this correctly.

---

## Decision 5: Multi-Transport Configuration

**Decision**: Use a conditional spread on `transport.targets` based on `config.env` and credential availability. Always ensure at least one transport is active in every environment — never allow an empty targets array.

**Three routing cases**:
| Environment | Condition | Active Transport |
|---|---|---|
| `development` | `config.env === 'development'` | `pino-pretty` (colorized stdout) |
| `preview` / `production` with token | `config.env !== 'development' && config.logtailToken` | `@logtail/pino` |
| `preview` / `production` without token | `config.env !== 'development' && !config.logtailToken` | `pino/file` stdout JSON (safety fallback) |

**Why the fallback matters**: If `LOGTAIL_SOURCE_TOKEN` is missing in a non-dev environment (e.g. a new deployment before the env var is set), an empty `targets` array causes Pino to silently drop all logs. The stdout JSON fallback ensures logs are always emitted somewhere, even if not to Better Stack. This is critical for catching the "missing env var" situation at deployment time.

**Pattern**:
```ts
const isDev = config.env === 'development';

transport: {
  targets: [
    ...(isDev
      ? [{ target: 'pino-pretty', level: 'debug', options: { colorize: true } }]
      : config.logtailToken
        ? [{ target: '@logtail/pino', level: 'info', options: { sourceToken: config.logtailToken } }]
        : [{ target: 'pino/file', level: 'info', options: { destination: 1 } }]  // stdout JSON fallback — destination: 1 = stdout fd
    ),
  ],
},
```

Note: `pino/file` is a built-in Pino transport (no extra package) that writes to a file descriptor. `destination: 1` is stdout.

**Rationale for `config.env` over `NODE_ENV`**: The existing codebase uses `config.env` (derived from `VERCEL_ENV`) as the source of truth for environment, per Constitution Principle II. Using it here ensures consistent environment detection.

---

## Decision 6: Log Entry Field Enrichment

**Decision**: Auto-enrich every log entry with `level` (string), `time` (ISO 8601), `env`, and `service` fields via Pino's `formatters` and `base` options.

**`base`**: Set to `{ service: 'sol-notification-service' }` — adds `service` to every log line.

**`formatters.bindings`**: Returns `{ ...bindings, env: config.env }` — adds `env` to every log line at logger creation. This is what enables filtering between `preview` and `production` in the Better Stack UI using `env = 'production'` or `env = 'preview'`.

**`formatters.level`**: Returns `{ level: label }` — emits `"level": "info"` instead of the default `"level": 30`. Human-readable and compatible with Better Stack's level filter UI.

**`timestamp`**: Use `pino.stdTimeFunctions.isoTime` — emits `"time": "2026-03-05T10:00:00.000Z"`. Better Stack's `_time` field ingestion works best with ISO 8601 strings.

---

## Decision 7: Backwards-Compatible Wrapper

**Decision**: The existing `log()` and `logError()` signatures from `src/utils/logger.ts` are fully preserved. The internal implementation is replaced with Pino calls. Zero call-site changes are required.

**Current signature**:
```ts
log(message: string, context?: LogContext): void
logError(message: string, error: unknown, context?: LogContext): void
```

**Wrapper pattern**:
```ts
export function log(message: string, context?: LogContext): void {
  const { clientId, ...rest } = context ?? {};
  logger.info({ clientId, ...rest }, message);
}

export function logError(message: string, error: unknown, context?: LogContext): void {
  const { clientId, ...rest } = context ?? {};
  logger.error({ clientId, ...rest, err: error }, message);
}
```

Pino serializes `err` fields using its built-in error serializer (captures `message`, `stack`, `type`). This produces richer error output than the current `error.message` string concatenation.

---

## Decision 8: Transport Selection Based on config.env (not isProd)

**Decision**: The transport routing condition is `config.env === 'development'` for the dev gate, NOT `isProd` or `config.env === 'production'`.

**Why this matters**: Using `isProd` (i.e. `config.env === 'production'`) as the gate would leave preview deployments (`VERCEL_ENV=preview`) with neither `pino-pretty` (a devDep not installed in CI) nor the Better Stack transport. Preview deployments are the most common place to debug issues before they reach production — they must have active log transport.

The condition `config.env === 'development'` correctly covers only local dev and routes both `preview` and `production` to Better Stack.

---

## Decision 9: Graceful Shutdown — Export `flush()` from `logger.ts`

**Decision**: Export a `flush()` function from `src/utils/logger.ts`. The SIGTERM handler in `src/index.ts` calls this exported function.

**Why not `logger.flush()` directly in `index.ts`**: `src/index.ts` imports only the `log` and `logError` functions from `logger.ts`. The `pino` instance is internal to `logger.ts` and not exported. Writing `logger.flush()` in `index.ts` would be a runtime error (the variable `logger` doesn't exist in that scope).

**Correct pattern**:
```ts
// In logger.ts — export a flush helper
export function flush(): void {
  pinoLogger.flush();
}

// In index.ts — import and call it
import { log, logError, flush } from './utils/logger';
process.on('SIGTERM', () => flush());
```

**Rationale**: Pino's worker-thread transport is async. Without a flush call on SIGTERM, the last batch of logs (particularly error logs immediately before a crash) may not reach Better Stack. Vercel sends SIGTERM before hard-killing instances.

---

## Decision 10: Config.ts Integration for Credentials

**Decision**: Add `logtailToken` (nullable string) to `src/lib/config.ts`. All transport configuration reads from `config.logtailToken`, never from `process.env.LOGTAIL_SOURCE_TOKEN` directly.

**Rationale**: Constitution Principle II and the codebase-wide convention (enforced in CLAUDE.md) require environment config to be read exclusively via `src/lib/config.ts`. The logger must follow this rule. Unlike `DATABASE_URL`, a missing `LOGTAIL_SOURCE_TOKEN` should NOT cause the config module to throw — it is optional (logger degrades gracefully to stdout when absent).

**Config addition**:
```ts
// In config.ts — add to the config object, no throw if absent
logtailToken: process.env.LOGTAIL_SOURCE_TOKEN ?? null,
```

No `LOGTAIL_DATASET` equivalent is needed — Better Stack sources are identified solely by `sourceToken`.

---

## Decision 11: Test Isolation — Pino Worker Threads

**Decision**: All test files that import (directly or indirectly) from `src/utils/logger.ts` MUST mock the logger module at the top level with `vi.mock`.

**Why**: Pino spawns a worker thread at logger instantiation. In Vitest, tests that import `logger.ts` without mocking it will spin up real worker threads, producing noisy terminal output during test runs and potentially causing flaky behavior if the worker thread interferes with Vitest's process management.

**Existing tests are already safe**: All current test files mock the logger:
```ts
vi.mock('../../utils/logger', () => ({
  log: vi.fn(),
  logError: vi.fn(),
}));
```
The new `flush` export must be added to this mock object to avoid TypeScript errors after it is exported.

**Updated mock pattern** (add `flush` to all existing logger mocks):
```ts
vi.mock('../../utils/logger', () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));
```

---

## Decision 12: Constitution Amendment Required

**Decision**: This feature requires a MINOR amendment to the project constitution (v1.0.0 → v1.1.0) to add Pino, pino-pretty, `@logtail/pino`, and Better Stack to the approved technology stack per Principle VI.

**Rationale**: Constitution Principle VI states that additions to the approved stack require a MINOR version amendment. The current stack table does not include a structured logging library or log management platform.

**Amendment scope**: MINOR (new external service + new npm packages; no core service replacement, no principle redefinition).
