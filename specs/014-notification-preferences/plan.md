# Implementation Plan: Per-Client Notification Preferences

**Branch**: `014-notification-preferences` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)

## Summary

Add per-workflow recipient lists to the client settings JSONB column. A new shared helper (`resolveRecipients`) reads the list for the given workflow key and falls back to `client.email` when absent or empty. Both existing email workflows adopt the helper. `EmailRequest.to` is extended to `string | string[]` to support multi-recipient sends via the existing Resend abstraction.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x` — all existing; zero new packages  
**Storage**: Neon PostgreSQL — no schema changes; uses existing `clients.settings JSONB` column  
**Testing**: Vitest 2.x  
**Target Platform**: Vercel (Node.js 20) + Inngest Cloud  
**Project Type**: Event-driven notification service  
**Performance Goals**: No change from existing baseline  
**Constraints**: Zero new packages; zero schema migrations; all existing tests must continue to pass  
**Scale/Scope**: All active clients; 2 existing workflows affected

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ Pass | No new functions; existing step wrappers unchanged |
| II — Multi-Environment Safety | ✅ Pass | `mock`/`test`/`live` modes continue to work; test mode redirects full recipient list to `TEST_EMAIL` |
| III — Multi-Tenant by Design | ✅ Pass | Recipients resolved per `clientId` from DB settings at runtime |
| IV — Observability by Default | ✅ Pass | `resolveRecipients` logs warnings for invalid addresses; `log-result` step logs resolved recipients |
| V — AI-Agent Friendly | ✅ Pass | Spec exists; helper follows single-responsibility pattern; template unchanged |
| VI — Minimal Infrastructure | ✅ Pass | Zero new packages; zero new infrastructure |

## Project Structure

### Documentation (this feature)

```text
specs/014-notification-preferences/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes

```text
src/
├── types/
│   └── index.ts                          # Extend EmailRequest.to + EmailResult fields
├── lib/
│   ├── notifications.ts                  # NEW — resolveRecipients() helper
│   └── email.ts                          # Extend validateRecipient + send logic for string[]
└── inngest/
    └── functions/
        ├── form-notification.ts          # Use resolveRecipients in send-email step
        └── weekly-analytics-report.ts   # Use resolveRecipients in send-email step

tests/
└── unit/
    ├── lib/
    │   └── notifications.test.ts         # NEW — unit tests for resolveRecipients
    └── inngest/
        └── functions/
            ├── form-notification.test.ts          # Add preference + fallback test cases
            └── weekly-analytics-report.test.ts    # Add preference + fallback test cases
```

**Structure Decision**: Single project layout (Option 1). No new directories needed beyond the new `notifications.ts` lib file.

## Implementation Phases

### Phase 1 — Type changes (`src/types/index.ts`)

Extend `EmailRequest.to` and `EmailResult.originalTo` / `actualTo` from `string` to `string | string[]`. This is the prerequisite for all other changes.

**Files**: `src/types/index.ts`

---

### Phase 2 — `resolveRecipients` helper (`src/lib/notifications.ts`)

New file. Exports a single pure function:

```ts
export function resolveRecipients(client: ClientRow, workflowKey: string): string[]
```

Resolution order:
1. Read `client.settings?.notifications?.[workflowKey]`
2. If not an array or absent → return `[client.email]`
3. Filter: keep strings that are non-empty and contain `@`; call `logError` for each filtered-out entry
4. If filtered array is empty → return `[client.email]`
5. Return filtered array

**Files**: `src/lib/notifications.ts` (new)

---

### Phase 3 — Email send layer (`src/lib/email.ts`)

Update `validateRecipient` to accept `string | string[]`:
- If array: validate each element; throw if array is entirely empty
- If string: existing behaviour

Update `sendEmail`:
- `mock` mode: log all recipients joined with `, `
- `test` mode: subject prefix becomes `[TEST: addr1, addr2] Subject`; `to` is redirected to `config.testEmail`
- `mailtrap` mode: pass `to` through as-is (nodemailer supports `string | string[]`)
- `live` mode: pass `to` through to `resend.emails.send()` (Resend SDK accepts `string | string[]`)

Update `EmailResult.originalTo` and `actualTo` to reflect the extended type.

**Files**: `src/lib/email.ts`

---

### Phase 4 — Workflow updates

**`form-notification.ts`**:

In the `send-email` step, replace `client.email` with `resolveRecipients(client, "form_submitted")`:

```ts
import { resolveRecipients } from "../../lib/notifications";

// inside step.run("send-email")
const recipients = resolveRecipients(client, "form_submitted");
return sendEmail({ to: recipients, subject: rendered.subject, html: rendered.html, attachments: rendered.attachments });
```

In `log-result`, join recipients for `recipient_email` logging: `Array.isArray(result.originalTo) ? result.originalTo.join(", ") : result.originalTo`

**`weekly-analytics-report.ts`**:

Same pattern using key `"analytics_report"`.

**Files**: `src/inngest/functions/form-notification.ts`, `src/inngest/functions/weekly-analytics-report.ts`

---

### Phase 5 — Tests

**`tests/unit/lib/notifications.test.ts`** (new):
- `notifications` key absent → returns `[client.email]`
- `notifications` present, key absent → returns `[client.email]`
- Key present, empty array → returns `[client.email]`
- Key present, valid addresses → returns those addresses
- Key present, mix of valid/invalid → returns only valid, logs warning per invalid
- Key present, all invalid → returns `[client.email]`

**`tests/unit/inngest/functions/form-notification.test.ts`** — add cases:
- Client with `form_submitted` list → `sendEmail` called with that list as `to`
- Client with no preference → `sendEmail` called with `client.email`

**`tests/unit/inngest/functions/weekly-analytics-report.test.ts`** — same pattern for `analytics_report` key.

**Files**: `tests/unit/lib/notifications.test.ts` (new), two existing test files extended

---

### Phase 6 — Seed data

Update `scripts/seed-data.ts` to include a `notifications` settings block on at least one seeded client (e.g. `hwhomes`), covering both workflow keys:

```ts
settings: {
  notifications: {
    form_submitted: ["sales@hwh-test.com", "owner@hwh-test.com"],
    analytics_report: ["marketing@hwh-test.com"],
  },
},
```

This ensures `npm run db:seed` produces immediately testable data without requiring manual SQL after pulling the branch.

**Files**: `scripts/seed-data.ts`

---

## Dependency Order

```
Phase 1 (types) → Phase 2 (helper) → Phase 3 (email layer) → Phase 4 (workflows) → Phase 5 (tests)
                                                                                           ↓
                                                                                     Phase 6 (seed data)
```

Phases 2 and 3 can begin in parallel after Phase 1. Phase 5 and 6 can be written alongside Phase 4.
