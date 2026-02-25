# Module Interface Contracts: Core Shared Infrastructure

**Feature Branch**: `002-core-infrastructure`
**Date**: 2026-02-25

This document defines the public TypeScript interfaces for each library module. These are the contracts that all Inngest workflow functions must use. Workflows MUST NOT bypass these interfaces to call Resend or the database directly.

---

## `src/lib/config.ts`

Singleton that reads and validates environment variables once at module load.

```typescript
// Exported value — imported by every module that needs environment context
export const config: AppConfig;
```

**Behavior**:
- Reads `VERCEL_ENV` and `EMAIL_MODE` environment variables
- Applies derivation rules (see data-model.md §3)
- Throws `Error` at startup if:
  - `EMAIL_MODE` is an unrecognized value
  - `EMAIL_MODE=live` and `RESEND_API_KEY` is not set
  - `EMAIL_MODE=test` and `TEST_EMAIL` is not set
  - `DATABASE_URL` is not set

**Usage in workflows**:
```typescript
import { config } from '../../../lib/config';
console.log(`[${config.env}] Starting workflow`);
```

---

## `src/lib/db.ts`

Neon Pool singleton and typed query helpers.

```typescript
export const db: Pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>>;

export async function getClientById(id: string): Promise<ClientRow>;

export async function checkDbConnection(): Promise<void>;
```

**`getClientById` behavior**:
- Returns the full `ClientRow` if found and active
- Throws `Error('Client not found: <id>')` if no row exists
- Throws `Error('Client inactive: <id>')` if `active = false`
- Throws descriptive error on connection failure (Inngest retries automatically)

**Usage in workflows** (always inside `step.run`):
```typescript
const client = await step.run('fetch-client-config', () => getClientById(event.data.clientId));
```

---

## `src/lib/email.ts`

Email abstraction enforcing mock/test/live routing. All email sends MUST go through this module.

```typescript
export async function sendEmail(request: EmailRequest): Promise<EmailResult>;
```

**Behavior by mode**:

| Mode | Action | Log entry |
|------|--------|-----------|
| `mock` | `console.log` only, no network call | `[mock] Would send to: <to> | Subject: <subject> | Body length: <n>` |
| `test` | Send to `config.testEmail` via Resend, subject prefixed `[TEST: <original>]` | `[test] Redirected to: <testEmail> (original: <to>)` |
| `live` | Send to original `to` via Resend | `[live] Sent to: <to> | Resend ID: <id>` |

**Validation** (throws before any send attempt):
- `request.to` must be non-empty
- `request.to` must contain `@`
- In `live` mode, throws if Resend returns a non-retryable error

**Usage in workflows** (always inside `step.run`):
```typescript
const result = await step.run('send-email', () =>
  sendEmail({ to: client.email, subject: 'Hello', html: '<p>Hello</p>' })
);
```

---

## `src/utils/logger.ts`

Structured logging utility ensuring every entry includes environment context.

```typescript
export function log(
  message: string,
  context?: { clientId?: string; [key: string]: unknown },
): void;

export function logError(
  message: string,
  error: unknown,
  context?: { clientId?: string; [key: string]: unknown },
): void;
```

**Output format**:
```
[development] [clientId=client-acme] Workflow started { eventName: 'form/submitted' }
[production]  Email sent { mode: 'live', to: 'user@example.com', resendId: 'abc123' }
```

**Usage in workflows**:
```typescript
import { log, logError } from '../../../utils/logger';
log('Workflow started', { clientId: event.data.clientId, eventName: event.name });
```

---

## `src/types/index.ts`

All shared TypeScript types and event payload schemas. No logic — types only.

```typescript
// Environment & config
export type AppEnv = 'development' | 'preview' | 'production';
export type EmailMode = 'mock' | 'test' | 'live';
export interface AppConfig { ... }

// Database rows
export interface ClientRow { ... }
export interface NotificationLogRow { ... }

// Email value objects
export interface EmailRequest { ... }
export interface EmailResult { ... }

// Inngest event payloads
export interface BaseEventPayload {
  clientId: string;
}
// Feature-specific payloads extend BaseEventPayload
// e.g., export interface FormSubmittedPayload extends BaseEventPayload { formId: string; ... }
```

**Rule**: All Inngest event payload types are defined here before the function is written (Constitution Principle V).

---

## Invariants (enforced across all modules)

1. Workflows never import `Resend` directly — only via `src/lib/email.ts`
2. Workflows never read `process.env` directly — only via `src/lib/config.ts`
3. Workflows never construct raw SQL — only via `src/lib/db.ts`
4. `log()` / `logError()` are called at function start and in all error paths
5. `clientId` is always included in log context when available
