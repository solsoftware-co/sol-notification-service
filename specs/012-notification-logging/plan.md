# Implementation Plan: Notification Send Logging

**Branch**: `012-notification-logging` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-notification-logging/spec.md`

## Summary

Extend the existing `notification_logs` table with columns for `recipient_email`, `subject`, `resend_id`, `error_message`, and `metadata` (JSONB). Update the `"log-result"` step in both `analytics-report` and `form-notification` workflows to write a row to this table after every email send attempt. Add `writeNotificationLog()` to `src/lib/db.ts`. Zero new packages required.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: inngest ^3.x, @neondatabase/serverless ^1.x, pino ^10.x (all existing — no new packages)
**Storage**: Neon PostgreSQL — `notification_logs` table extended via V002 migration
**Testing**: Vitest 2.1.x + @inngest/test 0.1.9
**Target Platform**: Vercel serverless (Node 20)
**Project Type**: Web service (Inngest worker)
**Performance Goals**: Log write adds one INSERT per email send — negligible overhead
**Constraints**: Log write failure must not trigger email send retry (FR-008)
**Scale/Scope**: One log row per email send; two workflows affected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I — Event-Driven Workflow First | Log write lives inside the existing `"log-result"` `step.run()` call. No synchronous DB calls outside steps. | ✅ PASS |
| II — Multi-Environment Safety | Log writes are guarded by `config.emailMode === 'live'`. Dev and preview environments skip the DB write entirely. | ✅ PASS |
| III — Multi-Tenant by Design | Every log row is scoped to `client_id`. No cross-tenant data access. | ✅ PASS |
| IV — Observability by Default | This feature IS the observability improvement. Pino logs are retained alongside DB writes. | ✅ PASS |
| V — AI-Agent Friendly | Spec exists. Pattern follows canonical template. Types added to `src/types/index.ts`. | ✅ PASS |
| VI — Minimal Infrastructure | Zero new packages. One ALTER TABLE migration. | ✅ PASS |

## Project Structure

### Documentation (this feature)

```text
specs/012-notification-logging/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — schema, types, function signature
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code Changes

```text
db/
└── migrations/
    └── V002__add_notification_log_columns.sql   # NEW — ALTER TABLE

src/
├── types/
│   └── index.ts                                 # MODIFY — add NotificationLogEntry, update NotificationLogRow
├── lib/
│   └── db.ts                                    # MODIFY — add writeNotificationLog()
└── inngest/
    └── functions/
        ├── form-notification.ts                 # MODIFY — update log-result step
        └── analytics-report.ts                  # MODIFY — update log-result step, remove debug log

tests/
└── unit/
    ├── lib/
    │   └── db.test.ts                           # MODIFY — add writeNotificationLog tests
    └── inngest/
        └── functions/
            ├── form-notification.test.ts        # MODIFY — update log-result mock/assertion
            └── weekly-analytics-report.test.ts  # MODIFY — update log-result mock/assertion
```

**Structure Decision**: Single-project layout, modifying existing files only. No new source files.

## Implementation Phases

### Phase 1: Migration + Types + DB Function

**Goal**: Data layer is ready. Nothing is wired to workflows yet.

**Steps**:
1. Write `db/migrations/V002__add_notification_log_columns.sql` — ALTER TABLE to add 5 columns (see data-model.md)
2. Update `src/types/index.ts`:
   - Add `NotificationLogEntry` interface (input type for DB write)
   - Update `NotificationLogRow` to include new columns and correct `outcome` to `'sent' | 'failed' | 'skipped'`
3. Add `writeNotificationLog(entry: NotificationLogEntry): Promise<void>` to `src/lib/db.ts`
4. Add unit tests for `writeNotificationLog()` in `tests/unit/lib/db.test.ts`:
   - Successful insert with all fields
   - Insert with null resend_id (mock mode)
   - Insert with error_message (failed outcome)

**Verification**: `npm run type-check` passes. Unit tests for `writeNotificationLog()` pass.

---

### Phase 2: Wire form-notification

**Goal**: Form notification workflow writes a log row after every send attempt.

**Steps**:
1. Update the `"log-result"` step in `src/inngest/functions/form-notification.ts`:
   - Guard the DB write: only call `writeNotificationLog()` when `config.emailMode === 'live'`
   - Pass `client_id`, workflow id, event name, `result.originalTo`, `result.subject`, `result.resendId`, and `metadata: { formData: event.data }`
   - Retain existing `log()` call (pino logging is additive, not replaced)
   - Set `outcome: result.outcome === 'sent' ? 'sent' : 'failed'`
2. Update `tests/unit/inngest/functions/form-notification.test.ts`:
   - Mock `writeNotificationLog` from `src/lib/db`
   - Assert it IS called when `emailMode === 'live'`
   - Assert it is NOT called when `emailMode === 'mock'` or `'test'`
   - Assert it is NOT called if the workflow errors before the log step

**Verification**: All existing form-notification tests pass. New assertions for `writeNotificationLog` pass.

---

### Phase 3: Wire analytics-report

**Goal**: Analytics report workflow writes a log row after every send attempt.

**Steps**:
1. Remove the debug log at `analytics-report.ts:141` (`"Hello World, I'm here!"`)
2. Update the `"log-result"` step in `src/inngest/functions/analytics-report.ts`:
   - Guard the DB write: only call `writeNotificationLog()` when `config.emailMode === 'live'`
   - Pass `client_id`, workflow id, event name, `result.originalTo`, `result.subject`, `result.resendId`, and `metadata: { ga4_property_id, period_preset, date_range_start, date_range_end }`
   - Retain existing `log()` call
   - Set `outcome: result.outcome === 'sent' ? 'sent' : 'failed'`
3. Update `tests/unit/inngest/functions/weekly-analytics-report.test.ts`:
   - Mock `writeNotificationLog` from `src/lib/db`
   - Assert it IS called when `emailMode === 'live'` with correct metadata fields
   - Assert it is NOT called when `emailMode === 'mock'` or `'test'`
   - Assert `ga4_property_id`, `period_preset`, `date_range_start`, `date_range_end` are present in `metadata`

**Verification**: All existing analytics-report tests pass. New assertions pass. `npm run type-check` clean.

---

### Phase 4: Integration Verification

**Goal**: Confirm end-to-end in development environment.

**Steps**:
1. Run `npm run db:migrate` against local/dev DB — confirm V002 applies cleanly
2. Run `npm run dev` and trigger a form notification via the Inngest Dev UI
3. Query `SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 5` — confirm row exists with correct fields
4. Confirm `metadata` contains the form payload and is valid JSON
5. Run full test suite: `npm test` — all tests pass

**Verification**: Log row present in DB. `npm test` green. `npm run type-check` green.
