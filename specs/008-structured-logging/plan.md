# Implementation Plan: Structured Logging with Pino + Better Stack

**Branch**: `008-structured-logging` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-structured-logging/spec.md`
**Revised**: 2026-03-05 — switched platform to Better Stack; incorporated 5 correctness fixes (empty targets fallback, config.ts integration, preview env routing, flush export, test isolation)

## Summary

Replace the current `console.log`-based logger in `src/utils/logger.ts` with Pino — the fastest structured Node.js logging library — and connect it to Better Stack for centralized, queryable log management. The existing `log()` / `logError()` call signatures are fully preserved; only the implementation file changes. In local development, logs stream to the terminal via `pino-pretty`; in production and preview environments, they are transported asynchronously to Better Stack via `@logtail/pino`. Every log entry is automatically enriched with `level` (string), `time` (ISO 8601), `env`, and `service` fields — enabling `env = 'preview'` vs `env = 'production'` filtering in the Better Stack UI.

Transport routing always ensures at least one active target: the `@logtail/pino` transport is used in non-dev when credentials are present; a stdout JSON fallback (`pino/file`) is used in non-dev when credentials are absent, preventing silent log dropping.

This feature directly addresses Constitution Principle IV (Observability by Default) and requires a MINOR constitution amendment (v1.0.0 → v1.1.0) to add Pino and Better Stack to the approved technology stack per Principle VI.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `pino` (logger), `@logtail/pino` (Better Stack transport), `pino-pretty` (dev terminal output, devDep only)
**Storage**: N/A — no database schema changes
**Testing**: Vitest 2.x (existing test suite); logger mock must be updated to include `flush`
**Target Platform**: Long-running Node.js 20 process on Vercel (not serverless/edge — ideal for worker-thread transports)
**Performance Goals**: Log overhead < 2% of step execution time; async transport must not block the main event loop
**Constraints**: Zero call-site changes; logger must degrade to stdout JSON (not silently drop) when `LOGTAIL_SOURCE_TOKEN` is absent; `pino-pretty` must not be required in non-dev environments; credentials must route through `config.ts`
**Scale/Scope**: Single file replacement (`src/utils/logger.ts`); minor additions to `src/index.ts` and `src/lib/config.ts`; 1 new env var; 3 new npm packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I — Event-Driven Workflow First | ✅ N/A | This is a utility library upgrade; no new Inngest functions are added |
| II — Multi-Environment Safety | ✅ Pass | Logger uses `config.env` for transport selection; credentials read via `config.ts`; non-dev without token falls back to stdout JSON (never empty targets); `env` field on every log line enables per-environment filtering |
| III — Multi-Tenant by Design | ✅ Pass | `clientId` continues to be passed as a context field; per-client log correlation is preserved |
| IV — Observability by Default | ✅ Pass | This feature is the observability upgrade; directly fulfills Principle IV |
| V — AI-Agent Friendly Codebase | ✅ Pass | Spec exists in `specs/008-structured-logging/`; simple single-file implementation pattern |
| VI — Minimal Infrastructure | ⚠️ Violation (justified) | Pino, pino-pretty, @logtail/pino, and Better Stack platform are not in the approved stack; requires MINOR constitution amendment — see Complexity Tracking |

**Post-Phase 1 re-check**: All gates pass. Implementation adds no new server infrastructure, no Docker, no new database. `npm run dev` continues to work unchanged. Better Stack is an external SaaS (no local setup required).

## Project Structure

### Documentation (this feature)

```text
specs/008-structured-logging/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 developer setup guide
├── checklists/
│   └── requirements.md  # Spec quality checklist (all pass)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts         # ADD logtailToken: string | null to AppConfig interface
├── lib/
│   └── config.ts        # ADD logtailToken nullable field to buildConfig()
└── utils/
    └── logger.ts        # REPLACE — Pino-based implementation

src/
└── index.ts             # ADD — import flush + register SIGTERM handler

tests/
└── unit/                # UPDATE — add flush: vi.fn() to all logger mocks
```

No new directories. No schema changes. No new Inngest functions.

**Structure Decision**: The change touches three existing files (`logger.ts` replacement, `config.ts` addition, `index.ts` addition) plus test mock updates. No architectural restructuring is needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Pino (new dependency, not in approved stack) | Current `console.log` logger cannot emit structured data, preventing field-based filtering and log correlation — both required by Principle IV and by FR-001–FR-003 | Adding `JSON.stringify` to the existing wrapper would provide structured output but no async transport, no worker-thread isolation, no level filtering, and no dev pretty-printing — building all of that from scratch produces exactly what Pino already provides |
| `@logtail/pino` + Better Stack (new external service) | Centralized queryable log storage (FR-006, FR-007, FR-008) cannot be satisfied by stdout alone | Self-hosted ELK stack violates the no-Docker/no-local-infra constraint; Datadog/New Relic have no meaningful free tier; Better Stack wins over Axiom on SQL queries, uptime monitoring, and alerting maturity — at this service's log volume (< 1 MB/month) the raw ingest limit difference is irrelevant |

**Required action**: Create a MINOR constitution amendment (v1.0.0 → v1.1.0) as part of the implementation tasks to add:
- `pino ^9.x` to the Technology Stack table
- `pino-pretty` (devDep) to the Technology Stack table
- `@logtail/pino ^3.x` to the Technology Stack table
- Better Stack (log management SaaS, free plan) to the Technology Stack table
- `LOGTAIL_SOURCE_TOKEN` to the standard environment variables in Development Standards

## Phase 0: Research

All NEEDS CLARIFICATION items resolved. See [`research.md`](./research.md) for full findings.

**Key decisions from research:**

1. **Platform**: Better Stack over Axiom — SQL queries, uptime monitoring, and alerting maturity matter more than raw free-tier ingest volume at this scale.
2. **Pino multi-transport**: Use `transport: { targets: [...] }` with a conditional ternary. Dev → `pino-pretty`. Non-dev with token → `@logtail/pino`. Non-dev without token → `pino/file` stdout JSON fallback (never empty targets).
3. **Preview routing**: Gate is `config.env === 'development'` (not `isProd`). Both `preview` and `production` route to Better Stack so preview deployments have active log transport.
4. **Field enrichment**: `formatters.bindings` injects `env`; `base` sets `service`; `formatters.level` emits string levels; `pino.stdTimeFunctions.isoTime` for ISO timestamps. The `env` field enables `env = 'preview'` vs `env = 'production'` filtering in the UI.
5. **Config.ts integration**: `LOGTAIL_SOURCE_TOKEN` added to `config.ts` as a nullable field (no throw if absent). All transport config reads from `config.logtailToken`.
6. **Flush export**: `logger.ts` exports a `flush()` function that wraps the internal `pinoLogger.flush()`. The SIGTERM handler in `index.ts` imports and calls this — `logger.flush()` is not accessible in `index.ts` scope otherwise.
7. **Test isolation**: All existing logger mocks must add `flush: vi.fn()`. Any new test that imports `logger.ts` without mocking it will spawn real Pino worker threads — mock at module level in all test files.
8. **Error serialization**: Pass raw `Error` objects as the `err` field to `pino.error()`. Pino's built-in serializer captures `message`, `name`, `stack`, and `type`.

## Phase 1: Design & Contracts

### Data Model

See [`data-model.md`](./data-model.md) for full wire format, field table, environment routing table, and environment variable reference.

**Log entry shape** (every field on every line):
```
level (string), time (ISO 8601), service, env, [clientId?], [err?], msg, [...rest]
```

### Contracts

**N/A** — `src/utils/logger.ts` is a purely internal module. No external API surface, no HTTP endpoints, no event schema changes. The existing TypeScript function signatures (`log()`, `logError()`) are preserved exactly. The new `flush()` export is internal infrastructure only.

### Quickstart

See [`quickstart.md`](./quickstart.md). Note: quickstart references Axiom steps — update to Better Stack during implementation (Create Source → copy Source Token → set `LOGTAIL_SOURCE_TOKEN`).

### Implementation Approach

**`src/types/index.ts` — add to AppConfig interface**:
```
logtailToken: string | null;
```

**`src/lib/config.ts` — add to buildConfig() return object**:
```
logtailToken: process.env.LOGTAIL_SOURCE_TOKEN ?? null
(no throw — missing token degrades gracefully to stdout fallback)
```

**`src/utils/logger.ts` — full replacement**:
```
- Import pino
- Initialize pino instance (kept module-private) with:
    - base: { service: 'sol-notification-service' }
    - timestamp: pino.stdTimeFunctions.isoTime
    - formatters.bindings: add env field (config.env)
    - formatters.level: emit string labels
    - transport.targets: three-way conditional
        dev      → pino-pretty
        non-dev + config.logtailToken → @logtail/pino
        non-dev + no token → pino/file stdout JSON fallback ({ destination: 1 })
- Export log() wrapping pinoLogger.info()
- Export logError() wrapping pinoLogger.error() with err field
- Export flush() wrapping pinoLogger.flush()
```

**`src/index.ts` — SIGTERM handler**:
```
import { flush } from './utils/logger';
process.on('SIGTERM', () => flush());
```

**`tests/unit/**/*.ts` — update all logger mocks**:
```
Add flush: vi.fn() to every vi.mock('../../utils/logger') factory
```

**`package.json` — dependency additions**:
```
pino              → dependencies
@logtail/pino     → dependencies
pino-pretty       → devDependencies
```

**`.env.local.example` — env var addition**:
```
# Better Stack source token — leave absent in local dev (falls back to stdout)
# LOGTAIL_SOURCE_TOKEN=
```

**`.specify/memory/constitution.md` — MINOR version amendment**:
```
Add pino, pino-pretty, @logtail/pino, and Better Stack to Technology Stack table
Add LOGTAIL_SOURCE_TOKEN to Development Standards environment variables
Bump version: 1.0.0 → 1.1.0
```
