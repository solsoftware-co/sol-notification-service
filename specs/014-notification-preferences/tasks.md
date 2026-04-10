# Tasks: Per-Client Notification Preferences

**Input**: Design documents from `specs/014-notification-preferences/`  
**Branch**: `014-notification-preferences`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

No new project structure required. All changes are within existing files or a single new file.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes and shared infrastructure that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Extend `EmailRequest.to` from `string` to `string | string[]` and update `EmailResult.originalTo` and `actualTo` to match in `src/types/index.ts`
- [x] T002 [P] Create `src/lib/notifications.ts` exporting `resolveRecipients(client: ClientRow, workflowKey: string): string[]` — reads `client.settings.notifications?.[workflowKey]`, filters invalid addresses with `logError` warnings, falls back to `[client.email]` when absent, empty, or all-invalid
- [x] T003 [P] Update `validateRecipient` in `src/lib/email.ts` to accept `string | string[]` — validate each element when array, throw if entirely empty
- [x] T004 Update `sendEmail` in `src/lib/email.ts` to handle `string | string[]` for `to` across all four modes: mock (log all joined with `, `), test (redirect all to `config.testEmail`, subject prefix lists all original addresses), mailtrap (pass through), live (pass through to Resend SDK)
- [x] T005 Write unit tests for `resolveRecipients` in `tests/unit/lib/notifications.test.ts` covering: `notifications` key absent → fallback; workflow key absent → fallback; empty array → fallback; valid addresses → returns list; mixed valid/invalid → returns valid only + logs warning; all invalid → fallback

**Checkpoint**: Types, shared helper, and email layer are complete. User story phases can now proceed.

---

## Phase 3: User Story 1 — Form submission alerts go to the right people (Priority: P1) 🎯 MVP

**Goal**: The `form/submitted` workflow resolves recipients from `settings.notifications.form_submitted`, falling back to `client.email`.

**Independent Test**: Seed a client with `settings.notifications.form_submitted = ["sales@example.com"]`, trigger a `form/submitted` event, verify the email `to` field is `["sales@example.com"]` and not `client.email`. Then remove the key and verify it reverts to `client.email`.

- [x] T006 [US1] Update the `send-email` step in `src/inngest/functions/form-notification.ts` to call `resolveRecipients(client, "form_submitted")` and pass the result as `to` in `sendEmail()`
- [x] T007 [US1] Update the `log-result` step in `src/inngest/functions/form-notification.ts` to join array recipients for `recipient_email`: `Array.isArray(result.originalTo) ? result.originalTo.join(", ") : result.originalTo`
- [x] T008 [US1] Add test cases to `tests/unit/inngest/functions/form-notification.test.ts`: client with `form_submitted` list → `sendEmail` called with that list as `to`; client with no preference → `sendEmail` called with `[client.email]`

**Checkpoint**: Form notification workflow fully supports per-client recipient lists with fallback. Independently testable.

---

## Phase 4: User Story 2 — Analytics reports go to the right people (Priority: P2)

**Goal**: The `analytics/report.requested` workflow resolves recipients from `settings.notifications.analytics_report`, falling back to `client.email`.

**Independent Test**: Seed a client with `settings.notifications.analytics_report = ["marketing@example.com"]`, trigger an `analytics/report.requested` event, verify the email `to` field is `["marketing@example.com"]`. Remove the key and verify fallback to `client.email`.

- [x] T009 [P] [US2] Update the `send-email` step in `src/inngest/functions/weekly-analytics-report.ts` to call `resolveRecipients(client, "analytics_report")` and pass the result as `to` in `sendEmail()`
- [x] T010 [US2] Update the `log-result` step in `src/inngest/functions/weekly-analytics-report.ts` to join array recipients for `recipient_email` (same pattern as T007)
- [x] T011 [P] [US2] Add test cases to `tests/unit/inngest/functions/weekly-analytics-report.test.ts`: client with `analytics_report` list → `sendEmail` called with that list; client with no preference → `sendEmail` called with `[client.email]`

**Checkpoint**: Both existing workflows support per-client recipient lists. US1 and US2 are independently testable.

---

## Phase 5: User Story 3 — New workflow types require no data model changes (Priority: P3)

**Goal**: Demonstrate that adding a future workflow with its own preference key requires only a call to `resolveRecipients` — no migrations, no infrastructure changes.

**Independent Test**: Read `src/lib/notifications.ts` and verify that `resolveRecipients` accepts any arbitrary `workflowKey` string. Confirm no hardcoded workflow keys exist in the helper itself.

- [x] T012 [US3] Update `scripts/seed-data.ts` to include a `notifications` settings block on at least one seeded client covering both `form_submitted` and `analytics_report` keys with example addresses, so `npm run db:seed` produces immediately testable data

**Checkpoint**: Extensibility pattern is in place. Any future workflow adopts it by calling `resolveRecipients` with a new key string — no other changes required.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T013 Run `npm run type-check` and resolve any TypeScript errors introduced by the `string | string[]` type changes
- [x] T014 [P] Run full test suite with `npm test` and confirm all pre-existing tests still pass (zero regression)
- [x] T015 [P] Manually validate the feature against `specs/014-notification-preferences/quickstart.md` using the Inngest Dev UI at `localhost:8288`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: Start immediately — no prior phases
  - T001 must complete first (type changes unblock T002, T003)
  - T002 and T003 can run in parallel after T001
  - T004 runs after T003 (same file)
  - T005 runs after T002
- **US1 (Phase 3)**: Depends on Phase 2 complete
- **US2 (Phase 4)**: Depends on Phase 2 complete — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 complete — can run in parallel with US1 and US2
- **Polish (Phase 6)**: Depends on all prior phases complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3
- **US2 (P2)**: No dependency on US1 or US3 — fully parallel after foundational
- **US3 (P3)**: No dependency on US1 or US2 — seed data change is standalone

### Parallel Opportunities

```
T001
├── T002 (parallel)   → T005
└── T003 (parallel)   → T004
         ↓
    [Phase 2 complete]
         ↓
    ┌────────────────────────────────────┐
    │ T006 → T007 → T008 (US1)          │
    │ T009 → T010 → T011 (US2) parallel │
    │ T012 (US3)            parallel    │
    └────────────────────────────────────┘
         ↓
    T013 → T014 (P) + T015 (P)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T005)
2. Complete Phase 3: US1 (T006–T008)
3. **STOP and VALIDATE**: Trigger `form/submitted` with a client that has `form_submitted` preferences set
4. Ship if form notification behaviour is confirmed correct

### Incremental Delivery

1. Phase 2 → foundation ready
2. Phase 3 (US1) → form notifications respect preferences ✓
3. Phase 4 (US2) → analytics reports respect preferences ✓
4. Phase 5 (US3) → seed data + extensibility demonstrated ✓
5. Phase 6 → polish and full regression check ✓

---

## Notes

- [P] tasks operate on different files and have no cross-dependencies
- T002 and T003 are the most impactful parallel opportunity — assign to separate work streams if possible
- US1 and US2 (T006–T008, T009–T011) are fully independent and can be completed by different developers simultaneously
- All test tasks use existing Vitest patterns from the codebase — see `tests/unit/inngest/functions/form-notification.test.ts` for mocking conventions
