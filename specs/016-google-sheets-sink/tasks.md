# Tasks: Google Sheets Sink for Form Notifications

**Input**: Design documents from `/specs/016-google-sheets-sink/`
**Branch**: `016-google-sheets-sink`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Add the new direct dependency before any implementation begins.

- [x] T001 Add `google-auth-library` as a direct dependency via `npm install google-auth-library` — promotes existing transitive package (already in `node_modules`) to explicit dep in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration, shared types, and DB query updates that every user story depends on. No user story work can begin until T007 is complete.

**⚠️ CRITICAL**: T004, T005, T006 can be written in parallel (same file, but non-overlapping sections — coordinate if pairing). T007 depends on T006.

- [x] T002 Create `db/migrations/V003__add_google_service_account_columns.sql` with two `ALTER TABLE clients ADD COLUMN` statements: `google_service_account_email TEXT NULL` and `google_service_account_key TEXT NULL`
- [x] T003 Apply the migration by running `npm run db:migrate` — verify both columns appear in the `clients` table
- [x] T004 [P] Add `GoogleSheetsDestination` interface to `src/types/index.ts` — fields: `spreadsheetId: string`, `sheetName?: string`, `columns?: string[]`
- [x] T005 [P] Add `sheetsDestination?: GoogleSheetsDestination` field to `FormSubmittedPayload` in `src/types/index.ts`
- [x] T006 [P] Add `google_service_account_email: string | null` and `google_service_account_key: string | null` to the `Client` type in `src/types/index.ts` (or `src/lib/db.ts` — wherever `Client` is currently defined)
- [x] T007 Update `getClientById()` in `src/lib/db.ts` — if query uses explicit `SELECT` column list, add `google_service_account_email` and `google_service_account_key`; if it uses `SELECT *` already, verify the returned type matches the updated `Client` interface

**Checkpoint**: Run `npm run type-check` — must pass with zero errors before proceeding.

---

## Phase 3: User Story 1 — Core Sheets Append Step (Priority: P1) 🎯 MVP

**Goal**: A calling application includes `sheetsDestination` in a `form/submitted` event payload; the workflow appends one row to the specified Google Sheet (in `live` mode) in addition to sending the email.

**Independent Test**: In mock mode, fire a `form/submitted` event with `sheetsDestination` via the Inngest Dev UI and verify the `sync-to-google-sheets` step runs and logs `"skipped (non-live mode)"`. For a live-mode test, follow `quickstart.md` Option B and verify a row appears in the target sheet.

- [x] T008 [US1] Create `src/lib/sheets.ts` — implement the full module as specified in `data-model.md` and `plan.md` Phase D:
  - `getSheetsAccessToken(credentialsJson)` — parses JSON key, creates `JWT` auth client from `google-auth-library`, returns bearer token
  - `resolveRow(destination, fields, timestamp)` — applies `columns[]` mapping if present, defaults to `[timestamp, ...Object.values(fields)]` if absent; maps `"_timestamp"` to ISO-8601 timestamp; missing fields → `""`
  - `appendSheetRow(credentialsJson, destination, fields, timestamp)` — orchestrates auth + REST call to `sheets.googleapis.com` append endpoint; returns `SheetAppendResult`; never throws
  - Export `SheetAppendResult` interface
- [x] T009 [US1] Add `sync-to-google-sheets` step to `src/inngest/functions/form-notification.ts` (insert between existing `send-email` and `log-result` steps):
  - Skip with `{ skipped: true, reason: 'no destination in payload' }` if `data.sheetsDestination` is absent
  - Skip with `{ skipped: true, reason: 'no credentials on client' }` if `client.google_service_account_key` is null
  - Skip with `{ skipped: true, reason: 'non-live mode' }` if `config.emailMode !== 'live'`
  - Otherwise build `fields` by flattening the relevant `FormSubmittedPayload` string fields into a `Record<string, string>` and call `appendSheetRow()`
  - Store return value as `sheetsOutcome` — pass to the `log-result` step

**Checkpoint**: Fire a `form/submitted` event without `sheetsDestination` — email delivers, no sheets step error. Fire one with `sheetsDestination` in mock mode — step runs and returns a skip result.

---

## Phase 4: User Story 2 — Non-Blocking Failure Handling (Priority: P2)

**Goal**: A Sheets write failure never prevents email delivery; the outcome (success or failure with reason) is recorded in the notification log for every invocation that included a `sheetsDestination`.

**Independent Test**: Fire a `form/submitted` event with an invalid `spreadsheetId` (e.g., `"INVALID"`). Verify in the Inngest Dev UI that the `send-email` step succeeded, and in `notification_logs.metadata` that `sheetsOutcome.success === false` with a populated `error` field.

- [x] T010 [US2] Update the `log-result` step in `src/inngest/functions/form-notification.ts` to include `sheetsOutcome` in the `metadata` object written to `notification_logs` — store under key `sheets_outcome`
- [x] T011 [P] [US2] Write unit tests for `appendSheetRow()` in `tests/unit/lib/sheets.test.ts`:
  - Mock `google-auth-library` `JWT` class and global `fetch`
  - Test: Sheets API returns 403 → `{ success: false, error: 'Sheets API 403: ...' }`
  - Test: Sheets API returns 404 → `{ success: false, error: ... }`
  - Test: `JSON.parse` fails (malformed key) → `{ success: false, error: ... }`
  - Test: `auth.getAccessToken()` returns null token → `{ success: false, error: 'Failed to obtain access token...' }`
  - Test: Successful API response → `{ success: true, rowsAppended: 1 }`

**Checkpoint**: Run `npm test` — all sheets unit tests pass. Verify in a manual run that email delivery is unaffected when the step returns `{ success: false }`.

---

## Phase 5: User Story 4 — Analytics Reports Use Per-Client Credentials (Priority: P2)

**Goal**: The weekly analytics report authenticates with GA4 using the client's registered service account credentials fetched from the database, not the global `GA4_SERVICE_ACCOUNT_JSON` environment variable. The env var is fully removed.

**Independent Test**: Remove `GA4_SERVICE_ACCOUNT_JSON` from `.env.local`. Trigger a weekly analytics report for a client with `google_service_account_key` set. Verify live GA4 data is returned. Trigger for a client without credentials — verify mock data is returned with no errors.

These tasks touch entirely different files from Phase 3/4 and can begin in parallel with Phase 3 if working across files.

- [x] T012 [US4] Refactor `src/lib/analytics.ts`:
  - Change `getAnalyticsReport()` signature: add `credentialsJson: string | null` as the third argument (before `options`)
  - Update internal `createClient()` to accept and use the passed-in `credentialsJson` instead of `config.ga4CredentialsJson`
  - Update mock fallback condition from `!config.ga4CredentialsJson` to `!credentialsJson`
  - Remove all references to `config.ga4CredentialsJson` within the file
- [ ] T013 [US4] Remove `ga4CredentialsJson` from `src/lib/config.ts` — delete the property, its env var read (`GA4_SERVICE_ACCOUNT_JSON`), and any associated type declaration
- [ ] T014 [US4] Update `src/inngest/functions/weekly-analytics-report.ts` to pass `client.google_service_account_key` as the `credentialsJson` argument to `getAnalyticsReport()`
- [ ] T015 [P] [US4] Update analytics unit tests in `tests/unit/lib/analytics.test.ts` — replace any references to `config.ga4CredentialsJson` mock with the explicit `credentialsJson` parameter; add test case for `credentialsJson: null` → mock data returned

**Checkpoint**: Run `npm run type-check && npm test` — zero errors. Confirm `GA4_SERVICE_ACCOUNT_JSON` is no longer referenced anywhere in `src/` via `grep -r "GA4_SERVICE_ACCOUNT_JSON" src/`.

---

## Phase 6: User Story 3 — Caller-Controlled Column Mapping (Priority: P3)

**Goal**: A calling application includes a `columns` array in `sheetsDestination`; the sheet row respects the declared field order, with missing fields as empty strings and `"_timestamp"` resolved to the submission timestamp.

**Independent Test**: Fire a `form/submitted` event with `sheetsDestination.columns: ["_timestamp", "submitterEmail", "submitterName"]` and verify the appended row matches that exact column order (timestamp, then email, then name).

The `resolveRow()` implementation is already complete from T008. This phase adds test coverage to validate all column mapping behaviours explicitly.

- [x] T016 [P] [US3] Write `resolveRow()` unit tests in `tests/unit/lib/sheets.test.ts` (alongside Phase 4 tests):
  - Test: `columns` absent → `[timestamp, field1Value, field2Value]` (received key order)
  - Test: `columns: ["_timestamp", "submitterEmail"]` → `[timestamp, "jane@example.com"]`
  - Test: `columns: ["submitterName", "missingField"]` where `missingField` not in submission → `["Jane", ""]`
  - Test: `columns: []` (empty array) → `[]`
  - Test: `columns: ["_timestamp"]` only → `[timestamp]`

**Checkpoint**: Run `npm test` — all `resolveRow` tests pass. Fire a manual event with a custom `columns` array and verify the sheet row order in the Inngest Dev UI step output.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T017 Run `npm run type-check` across the full project and fix any residual TypeScript errors introduced by the type changes in Phase 2 (e.g., callers of `getAnalyticsReport()` that haven't been updated)
- [x] T018 [P] Run `npm test` — full test suite must pass with no regressions in existing tests (form-notification, analytics, db, email tests)
- [x] T019 [P] Search for any remaining references to `config.ga4CredentialsJson` or `GA4_SERVICE_ACCOUNT_JSON` in `src/` and remove them: `grep -r "ga4CredentialsJson\|GA4_SERVICE_ACCOUNT_JSON" src/`
- [x] T020 Validate the quickstart.md mock-mode flow end-to-end: fire a `form/submitted` event with a `sheetsDestination` in mock mode via the Inngest Dev UI, confirm step skips correctly and email preview is generated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 3 (T009 must exist before T010 adds log metadata)
- **Phase 5 (US4)**: Depends on Phase 2 only — can run in parallel with Phase 3/4 (entirely different files)
- **Phase 6 (US3)**: Depends on Phase 3 (T008 must exist before US3 tests can be written)
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete. No dependency on US2, US3, US4.
- **US2 (P2)**: Requires US1 complete (T009 must exist for T010 to extend it).
- **US4 (P2)**: Requires Phase 2 complete only. Can be implemented in parallel with US1/US2 — touches `analytics.ts`, `config.ts`, `weekly-analytics-report.ts` exclusively.
- **US3 (P3)**: Requires US1 complete (T008 must exist for T016 tests to reference it).

### Parallel Opportunities Within Phases

**Phase 2**: T004, T005, T006 can be written in parallel (non-overlapping regions of `src/types/index.ts`). T007 must follow T006.

**Phase 5 vs Phase 3/4**: These can run in parallel on separate branches or by separate developers — zero file overlap.

**Phase 6 (T016) vs Phase 4 (T011)**: Both write to `tests/unit/lib/sheets.test.ts` — coordinate to avoid conflicts, or write together.

---

## Parallel Example: Phase 5 (US4) alongside Phase 3 (US1)

```
Developer A: Phase 3
  T008 → Create src/lib/sheets.ts
  T009 → Add step to src/inngest/functions/form-notification.ts

Developer B (simultaneously): Phase 5
  T012 → Refactor src/lib/analytics.ts
  T013 → Remove ga4CredentialsJson from src/lib/config.ts
  T014 → Update src/inngest/functions/weekly-analytics-report.ts
  T015 → Update tests/unit/lib/analytics.test.ts
```

No shared files between these two tracks. Both merge cleanly after Foundational phase is complete.

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 1 (T001)
2. Complete Phase 2 (T002–T007)
3. Complete Phase 3 (T008–T009)
4. **Validate**: Fire a test event in mock mode, verify step executes and skips correctly
5. If live testing available: Follow quickstart.md Option B and verify row appears in sheet

### Incremental Delivery

1. Setup + Foundational → types and schema ready
2. US1 → Sheets integration live (MVP)
3. US2 → Failure outcomes logged → operational confidence
4. US4 → GA4 migrated → global env var removed
5. US3 → Column mapping tested and validated
6. Polish → CI green, quickstart validated

### Task Count Summary

| Phase | Tasks | Parallelizable |
|-------|-------|---------------|
| Phase 1: Setup | 1 | 0 |
| Phase 2: Foundational | 6 | 3 (T004, T005, T006) |
| Phase 3: US1 | 2 | 0 |
| Phase 4: US2 | 2 | 1 (T011) |
| Phase 5: US4 | 4 | 1 (T015) |
| Phase 6: US3 | 1 | 1 (T016) |
| Phase 7: Polish | 4 | 2 (T018, T019) |
| **Total** | **20** | **8** |
