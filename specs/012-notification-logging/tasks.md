# Tasks: Notification Send Logging

**Input**: Design documents from `/specs/012-notification-logging/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Unit tests are included — all test assertions use Vitest 2.x + @inngest/test 0.1.9.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Write the database migration that all subsequent tasks depend on.

- [x] T001 Write `db/migrations/V002__add_notification_log_columns.sql` — ALTER TABLE to add `recipient_email TEXT`, `subject TEXT`, `resend_id TEXT`, `error_message TEXT`, `metadata JSONB NOT NULL DEFAULT '{}'` to `notification_logs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, DB function, and its unit tests. No workflow wiring yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add `NotificationLogEntry` interface to `src/types/index.ts` — fields: `client_id`, `workflow`, `event_name`, `outcome ('sent'|'failed'|'skipped')`, `recipient_email`, `subject`, `resend_id?`, `error_message?`, `metadata: Record<string, unknown>`
- [x] T003 [P] Update `NotificationLogRow` interface in `src/types/index.ts` — add new columns (`recipient_email`, `subject`, `resend_id`, `error_message`, `metadata`) and correct `outcome` type from `"success"` to `"sent" | "failed" | "skipped"`
- [x] T004 Add `writeNotificationLog(entry: NotificationLogEntry): Promise<void>` to `src/lib/db.ts` — single INSERT using the existing `query<T>()` wrapper; `resend_id` and `error_message` default to `null` when undefined
- [x] T005 Add unit tests for `writeNotificationLog()` in `tests/unit/lib/db.test.ts` — three cases: successful insert with all fields, insert with `resend_id` null (mock mode), insert with `error_message` set (failed outcome)

**Checkpoint**: DB function is ready and tested. Workflow wiring can now begin.

---

## Phase 3: User Story 1 — Audit Sent Emails + User Story 2 — Reproduce Locally (Priority: P1 + P2) 🎯 MVP

**Goal**: Every production email send writes a complete log record — recipient, subject, resend_id, outcome, and a metadata payload containing all workflow inputs needed to re-render the email locally. US1 and US2 are implemented together because metadata is populated in the same step as the other fields.

**Independent Test**: Trigger a weekly analytics email send with `emailMode = 'live'` in the unit test mock. Assert `writeNotificationLog` is called once with correct `recipient_email`, `subject`, `outcome: 'sent'`, a non-null `resend_id`, and `metadata` containing `ga4_property_id`, `period_preset`, `date_range_start`, and `date_range_end`.

### Implementation

- [x] T006 [US1] [US2] Update the `"log-result"` step in `src/inngest/functions/analytics-report.ts`:
  - Remove the debug `log("Hello World, I'm here!")` statement
  - Add live-mode guard: only call `writeNotificationLog()` when `config.emailMode === 'live'`
  - Pass `client_id`, `workflow: 'send-analytics-report'`, `event_name: 'analytics/report.requested'`, `recipient_email: result.originalTo`, `subject: result.subject`, `resend_id: result.resendId`, `outcome: result.outcome === 'sent' ? 'sent' : 'failed'`
  - Populate `metadata: { ga4_property_id: client.ga4PropertyId, period_preset: data.reportPeriod.preset, date_range_start: resolvedPeriod.startDate, date_range_end: resolvedPeriod.endDate }`
- [x] T007 [P] [US1] [US2] Update the `"log-result"` step in `src/inngest/functions/form-notification.ts`:
  - Add live-mode guard: only call `writeNotificationLog()` when `config.emailMode === 'live'`
  - Pass `client_id`, `workflow: 'send-form-notification'`, `event_name: 'form/submitted'`, `recipient_email: result.originalTo`, `subject: result.subject`, `resend_id: result.resendId`, `outcome: result.outcome === 'sent' ? 'sent' : 'failed'`
  - Populate `metadata: { formData: event.data }`
- [x] T008 Update `tests/unit/inngest/functions/weekly-analytics-report.test.ts`:
  - Mock `writeNotificationLog` from `src/lib/db`
  - Assert called once with correct fields when `emailMode === 'live'`, including all four metadata keys (`ga4_property_id`, `period_preset`, `date_range_start`, `date_range_end`)
  - Assert NOT called when `emailMode === 'mock'`
  - Assert NOT called when `emailMode === 'test'`
- [x] T009 [P] Update `tests/unit/inngest/functions/form-notification.test.ts`:  ✅ All tests passing
  - Mock `writeNotificationLog` from `src/lib/db`
  - Assert called once with correct fields when `emailMode === 'live'`, including `metadata.formData`
  - Assert NOT called when `emailMode === 'mock'`
  - Assert NOT called when `emailMode === 'test'`

**Checkpoint**: US1 and US2 are complete. A production email send writes a fully queryable, reproducible log record.

---

## Phase 4: User Story 3 — Distinguish Skipped Sends (Priority: P3)

**Goal**: When a client is missing a required configuration (e.g. no GA4 property), the analytics workflow writes a `skipped` log record instead of silently doing nothing or erroring.

**Independent Test**: In the unit test, configure a client with `ga4PropertyId: null`. Assert `writeNotificationLog` is called with `outcome: 'skipped'` and a non-null `error_message`. Assert the email send step is NOT reached.

### Implementation

- [x] T010 [US3] Add a skip guard to `src/inngest/functions/analytics-report.ts` after the `"fetch-client-config"` step: if `client.ga4PropertyId` is null or empty and `config.emailMode === 'live'`, call `writeNotificationLog()` with `outcome: 'skipped'`, `error_message: 'Client has no GA4 property configured'`, `recipient_email: client.email`, `subject: 'Weekly Analytics Report'`, and return early
- [x] T011 [US3] Update `tests/unit/inngest/functions/weekly-analytics-report.test.ts` — add test for the skip path: mock `getClientById` to return a client with no GA4 property, assert `writeNotificationLog` is called with `outcome: 'skipped'` and descriptive `error_message`, assert `sendEmail` is NOT called

**Checkpoint**: All three user stories complete. The notification log covers sent, failed, and skipped outcomes.

---

## Phase 5: Polish & Integration Verification

**Purpose**: End-to-end validation and cleanup.

- [x] T012 Run `npm run db:migrate` against the local dev database and confirm V002 applies cleanly with no errors
- [x] T013 [P] Run `npm run type-check` and confirm no TypeScript errors
- [x] T014 [P] Run `npm test` and confirm all tests pass with no regressions
- [x] T015 Start `npm run dev`, trigger a form notification via the Inngest Dev UI, query `SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 5` and confirm a row exists — note: `outcome` will be `'failed'` or no row in mock mode; this verifies the step runs without error, not that a DB row is written (live mode not used locally)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (migration written) — BLOCKS all user story work
- **Phase 3 (US1+US2)**: Depends on Phase 2 completion (T002–T005)
- **Phase 4 (US3)**: Depends on Phase 2 completion; Phase 3 recommended first but not strictly required
- **Phase 5 (Polish)**: Depends on all prior phases complete

### Within Phase 3

- T006 and T007 are independent (different files) — can run in parallel
- T008 depends on T006; T009 depends on T007 — write tests after implementation

### Within Phase 2

- T002 and T003 are independent (same file but different interfaces) — can run in parallel
- T004 depends on T002 (needs `NotificationLogEntry` type)
- T005 depends on T004

### Parallel Opportunities

- T002 + T003: both types in `src/types/index.ts` (same file — sequential in practice, but small)
- T006 + T007: different workflow files — fully parallel
- T008 + T009: different test files — fully parallel
- T013 + T014: independent validation commands

---

## Parallel Example: Phase 3

```bash
# Both workflow wiring tasks are independent:
Task T006: Update analytics-report.ts log-result step
Task T007: Update form-notification.ts log-result step

# After T006/T007 complete, test updates run in parallel:
Task T008: Update analytics-report tests
Task T009: Update form-notification tests
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 only)

1. Complete Phase 1: Migration
2. Complete Phase 2: Types + DB function + unit tests
3. Complete Phase 3: Wire both workflows (US1 + US2)
4. **STOP and VALIDATE**: Run `npm test`, confirm all tests pass
5. Merge — production email sends now produce queryable, reproducible log records

### Full Delivery (all three stories)

1. MVP above
2. Add Phase 4 (US3 skip logic) as a follow-on commit
3. Run Phase 5 integration check

---

## Notes

- `[P]` tasks touch different files — safe to run in parallel
- `writeNotificationLog()` is never called in mock or test mode — unit tests cover this branch explicitly
- The migration (T001) is safe to apply to existing databases — `ALTER TABLE` only, no data loss
- `NotificationLogRow.outcome` type correction (T003) has no runtime impact — nothing reads this field today
