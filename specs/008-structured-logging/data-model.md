# Data Model: Structured Logging

**Feature**: 008-structured-logging
**Date**: 2026-03-05
**Revised**: 2026-03-05 — updated for Better Stack; fixed environment routing table; added flush() to logger interface; added src/types/index.ts change

---

## Log Entry (Wire Format)

Every log entry emitted by the new logger is a JSON object with the following fields. Fields are grouped by source — some are auto-injected by Pino, some are auto-enriched via configuration, and some are caller-supplied.

### Auto-injected by Pino (always present)

| Field | Type | Example | Description |
|---|---|---|---|
| `level` | `number` | `30` | Log severity as Pino's standard numeric code (10=trace, 20=debug, 30=info, 40=warn, 50=error). Displayed as a human-readable string by both pino-pretty (dev) and Better Stack (production) automatically. Note: `formatters.level` is incompatible with `transport.targets` in Pino and is intentionally omitted. |
| `time` | `string` | `"2026-03-05T10:00:00.000Z"` | ISO 8601 UTC timestamp. Used by Better Stack for `_time` field auto-detection. |

### Auto-enriched via logger configuration (always present)

| Field | Type | Example | Description |
|---|---|---|---|
| `service` | `string` | `"sol-notification-service"` | Fixed service name. Set via `base` option at logger creation. |
| `env` | `string` | `"production"` | Current deployment environment (`development`, `preview`, `production`). Derived from `config.env`. Added via `formatters.bindings`. Enables per-environment filtering in Better Stack UI. |

### Caller-supplied context (optional, present when passed)

| Field | Type | Example | Description |
|---|---|---|---|
| `clientId` | `string` | `"client_abc123"` | The Inngest client identifier for multi-tenant correlation. Passed in the `LogContext` object. |
| `err` | `object` | `{ message: "...", stack: "..." }` | Serialized error object. Present only on `logError()` calls. Pino's built-in error serializer captures `message`, `name`, `stack`, and `type`. |
| `...rest` | `any` | `{ step: "send-email" }` | Any additional fields passed in the `LogContext` object beyond `clientId`. All extra keys are merged directly into the log entry. |

### Full example entry (production, info level)

```json
{
  "level": "info",
  "time": "2026-03-05T10:00:00.000Z",
  "service": "sol-notification-service",
  "env": "production",
  "clientId": "client_abc123",
  "msg": "Email sent successfully"
}
```

### Full example entry (production, error level)

```json
{
  "level": "error",
  "time": "2026-03-05T10:00:01.000Z",
  "service": "sol-notification-service",
  "env": "production",
  "clientId": "client_abc123",
  "err": {
    "type": "Error",
    "message": "GA4 request failed",
    "stack": "Error: GA4 request failed\n    at ..."
  },
  "msg": "Failed to fetch analytics data"
}
```

---

## Logger Interface

The public interface exposed by `src/utils/logger.ts`. `log()` and `logError()` are unchanged from the current implementation — no call sites require modification. `flush()` is a new export for graceful shutdown.

```ts
interface LogContext {
  clientId?: string;
  [key: string]: unknown;
}

function log(message: string, context?: LogContext): void
function logError(message: string, error: unknown, context?: LogContext): void
function flush(): void
```

### `log(message, context?)`

Maps to `pinoLogger.info({ ...context }, message)`. Emits a log entry at the `info` level. All `context` fields are merged into the log entry root object.

### `logError(message, error, context?)`

Maps to `pinoLogger.error({ ...context, err: error }, message)`. Emits a log entry at the `error` level. The `error` argument is serialized by Pino's built-in error serializer and written as the `err` field.

### `flush()`

Wraps `pinoLogger.flush()`. Called by the SIGTERM handler in `src/index.ts` to drain the async transport before process exit. The pino instance is not exported — this wrapper is the only external access to flush.

---

## Environment Routing

| `config.env` | Condition | Active Transport | Output |
|---|---|---|---|
| `development` | `config.env === 'development'` | `pino-pretty` | Colorized human-readable stdout |
| `preview` | `config.env !== 'development'` + token present | `@logtail/pino` | Better Stack (filterable by `env = 'preview'`) |
| `production` | `config.env !== 'development'` + token present | `@logtail/pino` | Better Stack (filterable by `env = 'production'`) |
| `preview` / `production` | `config.env !== 'development'` + token absent | `pino/file` (`destination: 1`) | stdout JSON — safety fallback, never empty targets |

The fallback row prevents silent log dropping if `LOGTAIL_SOURCE_TOKEN` is missing in a non-dev deployment.

---

## AppConfig Changes (`src/types/index.ts`)

The `AppConfig` interface gains one new nullable field:

| Field | Type | Description |
|---|---|---|
| `logtailToken` | `string \| null` | Better Stack source token. `null` when `LOGTAIL_SOURCE_TOKEN` is absent. Does not throw — absence triggers the stdout fallback. |

---

## New Environment Variables

| Variable | Environments | Description |
|---|---|---|
| `LOGTAIL_SOURCE_TOKEN` | Production, Preview | Better Stack source token (ingest-only). Absent in local dev — logger falls back to stdout JSON. |

Added to `.env.local.example` (commented out) and to Vercel environment variable configuration for Production and Preview environments.

---

## New Dependencies

| Package | Type | Purpose |
|---|---|---|
| `pino` | `dependency` | Core logger — long-running Node.js process, worker-thread transports |
| `@logtail/pino` | `dependency` | Better Stack transport (worker thread, async HTTP POST) |
| `pino-pretty` | `devDependency` | Human-readable terminal output in local development only |
