# Research: Core Shared Infrastructure

**Feature Branch**: `002-core-infrastructure`
**Date**: 2026-02-25
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Database Transport — `Pool` vs `neon()` HTTP

**Decision**: Use `Pool` (WebSocket transport) from `@neondatabase/serverless`

**Rationale**: The service is a long-running Node.js 20+ server (not an edge function). `Pool` reuses WebSocket connections across requests, reduces per-query latency, and supports multi-statement transactions. The `neon()` HTTP tagged-template transport is optimized for Vercel Edge Functions / Cloudflare Workers where persistent sockets are unavailable — it is not the right choice here.

**Alternatives considered**:
- `neon()` HTTP: rejected — higher per-query latency (new TLS handshake per query), no native transaction support.
- Native `pg` pool: rejected — `@neondatabase/serverless` is already approved in the constitution and is a drop-in `pg`-compatible replacement.

**Implementation**:
```typescript
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
```

---

## Decision 2: DB Singleton Pattern

**Decision**: Lazy singleton in `src/lib/db.ts` — Pool is created once at module load time; startup throws if `DATABASE_URL` is not set.

**Rationale**: Failing fast at startup (rather than at first query) gives immediate, actionable feedback when the environment is misconfigured (SC-006). Pool-level idle errors are captured via `pool.on('error', ...)` to avoid unhandled promise rejections.

**Typed query pattern**:
```typescript
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string, values?: unknown[]
): Promise<QueryResult<T>>
```
`Pool` supports the `query<T>(text, values)` generic overload — strong typing without casting.

---

## Decision 3: Resend SDK Error Handling

**Decision**: Pattern-match `{ data, error }` discriminated union — never rely on thrown exceptions for API errors.

**Rationale**: Resend SDK v3.5.0 never throws for API-level errors. The `error` field is typed as `ErrorResponse | null` with a fully-typed `RESEND_ERROR_CODE_KEY`. Network failures (fetch errors) can throw and should be caught separately.

**Retry-safe error names**: `rate_limit_exceeded`, `application_error`, `internal_server_error`
**Do not retry**: `invalid_from_address`, `invalid_api_Key`, `missing_api_key`, `missing_required_field`

**Minimum send fields**: `from`, `to`, `subject`, `html` — `from` must use a Resend-verified domain.

---

## Decision 4: Config Validation Strategy

**Decision**: Validate config at module load time; throw `Error` with the specific missing variable name.

**Rationale**: SC-006 requires a clear, human-readable error identifying the exact missing configuration with no stack trace required to diagnose. Throwing at import time (before the server starts accepting requests) satisfies this — the developer sees the error immediately in the terminal.

**Validation rules**:
- `EMAIL_MODE=live` → `RESEND_API_KEY` must be set
- `EMAIL_MODE=test` → `TEST_EMAIL` must be set
- `EMAIL_MODE` value not in `{mock, test, live}` → throw with recognized values listed
- `DATABASE_URL` must always be set (db.ts throws separately)

---

## Decision 5: `@neondatabase/serverless` Dependency

**Decision**: Must be installed — it is not yet in `package.json`.

**Approved version**: `^0.9.x` (per constitution Technology Stack table).

**Install command**: `npm install @neondatabase/serverless`

Note: `resend ^3.5.0` is already installed. No other new production dependencies are required for this feature.

---

## Decision 6: Script Execution Pattern

**Decision**: Database scripts (`scripts/setup-db.ts`, `scripts/seed-data.ts`) run via `tsx --env-file .env.local`.

**Rationale**: Consistent with how the dev server loads env vars. Scripts import `src/lib/db.ts` directly — no separate DB connection setup needed.

**Package.json additions**:
```json
"db:setup": "tsx --env-file .env.local scripts/setup-db.ts",
"db:seed":  "tsx --env-file .env.local scripts/seed-data.ts"
```

---

## Decision 7: Notification Logs Table — Deferred Writes

**Decision**: Create `notification_logs` table schema in `setup-db.ts` but do NOT write to it from any workflow in this feature.

**Rationale**: Explicitly stated in spec Assumptions: "The notification_logs table is created but not actively written to in this feature — logging to Inngest's own run history is sufficient for the PoC." This avoids scope creep and keeps the template clean.

---

## Decision 8: Workflow Template Registration

**Decision**: `src/inngest/functions/template.ts` is NOT registered in `src/inngest/functions/index.ts`.

**Rationale**: The template's purpose is to be copied and renamed. Registering it would expose a live function with a generic event name that could fire in production. Developers copy the file, rename it, update the event name, and add it to the index.

The template file includes a comment block explaining this.
