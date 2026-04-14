# Tasks: Per-Invocation Recipient Override

**Input**: Design documents from `/specs/017-payload-recipients/`  
**Branch**: `017-payload-recipients`

---

## Phase 1: Foundational (Type Definitions)

**Purpose**: TypeScript types that block all implementation tasks — must be defined before any function or test can be written.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `recipients?: string[]` optional field to `FormSubmittedPayload` interface in `src/types/index.ts`
- [X] T002 Add `RecipientResolutionResult` interface (`{ recipients: string[]; source: "payload" | "settings" | "client_email" }`) as a named export in `src/types/index.ts`

**Checkpoint**: Type definitions in place — TypeScript compilation will enforce correct usage across all call sites.

---

## Phase 2: User Stories 1 & 2 — Payload Override and Stored-Config Fallback (Priority: P1) 🎯 MVP

**Goal**: Update `resolveRecipients` to implement the three-tier chain (payload → settings → `client.email`) and update both call sites to use the new return type.

**Independent Test**: Fire a `form/submitted` event with `recipients: ["alice@example.com"]` — confirm email log shows that address as the recipient. Fire without `recipients` — confirm settings list or `client.email` is used as before.

### Implementation

- [X] T003 [US1] Rewrite `resolveRecipients` in `src/lib/notifications.ts` to accept `payloadRecipients?: string[] | null` as a third parameter, validate+deduplicate each tier, and return `RecipientResolutionResult` — full three-tier logic per `contracts/resolve-recipients.md`
- [X] T004 [US1] Update the `send-email` step in `src/inngest/functions/form-notification.ts` to call `resolveRecipients(client, "form_submitted", data.recipients)` and destructure `{ recipients, source }` from the result
- [X] T005 [US1] Update the `log-result` step in `src/inngest/functions/form-notification.ts` to include `recipient_source: source` in the `metadata` object written to `writeNotificationLog`
- [X] T006 [US2] Update the `send-email` step in `src/inngest/functions/analytics-report.ts` to destructure `{ recipients }` from `resolveRecipients(client, "analytics_report")` — no `payloadRecipients` argument; behaviour unchanged

**Checkpoint**: `npm run type-check` passes. Both workflows compile. A `form/submitted` event with `recipients` uses those addresses; one without uses existing fallback chain.

---

## Phase 3: User Story 3 — Invalid Recipients Handled Gracefully (Priority: P2)

**Goal**: Verify that invalid addresses in `recipients` are silently discarded and the fallback chain triggers correctly when all addresses are invalid.

**Independent Test**: Fire `form/submitted` with `recipients: ["valid@example.com", "not-an-email"]` — confirm only `valid@example.com` receives the email. Fire with `recipients: ["not-an-email"]` — confirm fallback to settings/`client.email`.

### Implementation

- [X] T007 [US3] Write unit tests for all resolution scenarios in `tests/unit/lib/notifications.test.ts`:
  - Payload with valid addresses → `source: "payload"`, deduplication (case-insensitive)
  - Payload with mix of valid + invalid → valid only, invalids discarded
  - Payload with all-invalid → falls back to settings list → `source: "settings"`
  - Payload with all-invalid, no settings → falls back to `client.email` → `source: "client_email"`
  - Empty array `[]` → same as absent → settings/`client.email` fallback
  - `null` → same as absent → settings/`client.email` fallback
  - No third argument → existing two-tier behaviour preserved (backwards compat)

**Checkpoint**: `npm test` passes. All scenarios from `contracts/resolve-recipients.md` Test Requirements table are covered.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T008 [P] Run `npm run type-check` and confirm zero type errors across all modified files
- [X] T009 [P] Run `npm test` and confirm all unit tests pass (including pre-existing `notifications.test.ts` tests if any)
- [ ] T010 Validate end-to-end using `quickstart.md` Options A–E via the Inngest Dev UI at `http://localhost:8288`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 & US2 (Phase 2)**: Requires T001 and T002 — BLOCKS on type definitions
- **US3 (Phase 3)**: Requires T003 (updated `resolveRecipients`) to test against
- **Polish (Phase 4)**: Requires all prior phases complete

### Within Phase 2

- T003 (`notifications.ts` rewrite) must complete before T004 and T006 — they use the new return type
- T004 must complete before T005 — both edit `form-notification.ts` (same file, avoid conflicts)
- T006 is independent of T004/T005 — different file, can run in parallel after T003

### Parallel Opportunities

```
Phase 1: T001 ║ T002          (different sections of same file — edit sequentially to be safe)
Phase 2: T003 → T004 → T005
               T003 → T006    (parallel with T004 after T003 complete)
Phase 3: T007                  (single file, sequential)
Phase 4: T008 ║ T009 → T010
```

---

## Implementation Strategy

### MVP (P1 Stories Only — Phases 1 & 2)

1. Complete Phase 1: Type definitions (T001, T002)
2. Complete Phase 2: Core logic + call sites (T003–T006)
3. **STOP and VALIDATE**: `npm run type-check` passes; manual test via Inngest Dev UI confirms payload override and fallback both work

### Full Delivery

4. Complete Phase 3: Unit test coverage (T007)
5. Complete Phase 4: Polish and end-to-end validation (T008–T010)

---

## Notes

- T003 is the most complex task — the full algorithm is specified in `contracts/resolve-recipients.md`; follow it exactly
- Deduplication: lowercase the address for comparison, keep the first-seen casing for delivery
- `analytics-report.ts` (T006) change is purely mechanical — only the destructure syntax changes; zero behaviour difference
- All three user stories are implemented inside `resolveRecipients` — the function test file (T007) is the primary regression guard
- No DB migration, no new packages, no new files beyond the test file
