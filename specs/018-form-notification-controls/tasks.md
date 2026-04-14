# Tasks: Form Notification Payload Controls

**Input**: Design documents from `/specs/018-form-notification-controls/`  
**Branch**: `018-form-notification-controls`

---

## Phase 1: Foundational (Type Definitions)

**Purpose**: TypeScript types that are prerequisites for all story implementation — must be in place before any function, template, or test can be written.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `FormNotificationCtaButton` discriminated union type (with `url` and `mailto` action variants) as a named export in `src/types/index.ts`
- [X] T002 Add `sendEmail?: boolean` and `ctaButton?: FormNotificationCtaButton` optional fields to `FormSubmittedPayload` in `src/types/index.ts`

**Checkpoint**: `npm run type-check` passes — TypeScript enforces correct usage at all call sites.

---

## Phase 2: User Story 1 — Email Send Toggle (Priority: P1) 🎯 MVP

**Goal**: When `sendEmail: false` is in the payload, the `send-email` step returns immediately without calling `sendEmail()`. All other steps (Sheets sync, logging) continue normally.

**Independent Test**: Fire `form/submitted` with `sendEmail: false` via the Inngest Dev UI — `send-email` step returns `{ skipped: true, reason: "sendEmail=false" }`, no email preview is written, Sheets sync still runs.

### Implementation

- [X] T003 [US1] Add a guard at the top of the `send-email` step in `src/inngest/functions/form-notification.ts`: if `data.sendEmail === false`, return `{ skipped: true, reason: "sendEmail=false" }` immediately before calling `sendEmail()`
- [X] T004 [US1] Update the `log-result` step in `src/inngest/functions/form-notification.ts` to handle the skipped email result — when `result.skipped === true`, write outcome `"skipped"` to the notification log (live mode) instead of `"sent"`/`"failed"`; skip the `writeNotificationLog` call for the skipped case in non-live mode

**Checkpoint**: `npm run type-check` passes. Firing with `sendEmail: false` shows `{ skipped: true }` in the Inngest Dev UI step output; firing without the field behaves identically to before.

---

## Phase 3: User Story 2 — Configurable CTA Button (Priority: P1)

**Goal**: The form notification email's CTA button label and action are resolved from the payload's `ctaButton` field. URL action opens the provided link; mailto action uses the provided or submitter email. Omitting `ctaButton` preserves today's default behaviour exactly.

**Independent Test**: Fire `form/submitted` with `ctaButton: { text: "View in CRM", action: { type: "url", url: "https://crm.example.com/lead/1" } }` — open `.email-preview/last.html` and confirm the button reads "View in CRM" and links to the CRM URL.

### Implementation

- [X] T005 [US2] Add `resolveCta(ctaButton, submitterEmail, submitterName)` pure helper function inside `src/lib/templates.ts` — full algorithm per `contracts/cta-resolution.md`; returns `{ ctaHref?: string; ctaLabel?: string }`
- [X] T006 [US2] Update `renderFormNotificationEmail` in `src/lib/templates.ts` to call `resolveCta(payload.ctaButton, payload.submitterEmail, payload.submitterName)` and pass `ctaHref` and `ctaLabel` as props to `SalesLeadV1Email`
- [X] T007 [US2] Update `InquiryEmailProps` in `src/emails/templates/sales-lead-v1.tsx` to add `ctaHref?: string` and `ctaLabel?: string` props; replace the `{customerEmail && <CTAButton .../>}` block with `{ctaHref && <CTAButton href={ctaHref} label={ctaLabel ?? "Reply"} variant="black" size="lg" radius="rounded" />}`
- [X] T008 [US2] Write unit tests covering all `resolveCta` scenarios from `contracts/cta-resolution.md` in `tests/unit/lib/templates.test.ts` (add a new `describe("resolveCta")` block to the existing file)

**Checkpoint**: `npm run type-check` passes. `npm test` passes. `.email-preview/last.html` shows the custom CTA when `ctaButton` is provided; default button still appears when it is omitted with `submitterEmail` present.

---

## Phase 4: User Story 3 — Controls Are Independent and Composable (Priority: P2)

**Goal**: Confirm that `sendEmail` and `ctaButton` work correctly when combined, and that omitting both preserves pre-018 behaviour exactly.

**Independent Test**: Fire two events — one with `sendEmail: false` + `ctaButton`, one with `sendEmail: true` + `ctaButton` — and confirm each behaves correctly without cross-contamination.

### Implementation

- [X] T009 [US3] Write unit tests for `sendEmail` skip scenarios in `tests/unit/inngest/functions/form-notification.test.ts`: `sendEmail: false` skips email; `sendEmail: true` (explicit) sends; `sendEmail` absent sends; `sendEmail: false` + `sheetsDestination` — Sheets step still runs
- [X] T010 [US3] Write unit test confirming that when both `sendEmail: false` and `ctaButton` are provided, no email is sent (CTA config is irrelevant)

**Checkpoint**: `npm test` passes. All three user story scenarios verified in test output.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T011 [P] Run `npm run type-check` — zero errors across all modified files
- [X] T012 [P] Run `npm test` — all tests pass (including pre-existing template and form-notification tests)
- [ ] T013 Validate end-to-end using `quickstart.md` Options A–G via the Inngest Dev UI and `.email-preview/last.html`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Requires T001, T002 — type definitions must exist
- **US2 (Phase 3)**: Requires T001, T002 — type definitions must exist; independent of US1
- **US3 (Phase 4)**: Requires T003 (sendEmail skip) and T005–T007 (CTA resolution) — validates their interaction
- **Polish (Phase 5)**: Requires all prior phases complete

### Within Phase 2 (US1)

- T003 must complete before T004 — both edit `form-notification.ts`

### Within Phase 3 (US2)

- T005 (`resolveCta` function) must complete before T006 (it calls it) and T008 (tests it)
- T006 must complete before T007 is useful to verify end-to-end — but T007 (template change) and T008 (tests) can run in parallel after T005

### Parallel Opportunities

```
Phase 1:  T001 → T002          (same file — sequential)
Phase 2:  T003 → T004          (same file — sequential)
Phase 3:  T005 → T006 → T007
                T005 → T008    (parallel with T006/T007 after T005)
Phase 4:  T009 ║ T010          (same file — sequential to avoid conflicts)
Phase 5:  T011 ║ T012 → T013
```

---

## Implementation Strategy

### MVP (US1 only — Phases 1 & 2)

1. Complete Phase 1: Type definitions (T001, T002)
2. Complete Phase 2: Email skip guard (T003, T004)
3. **STOP and VALIDATE**: `npm run type-check` passes; Dev UI test confirms skip behaviour

### Full Delivery

4. Complete Phase 3: CTA button resolution (T005–T008)
5. Complete Phase 4: Composability tests (T009, T010)
6. Complete Phase 5: Polish and end-to-end validation (T011–T013)

---

## Notes

- T003 guard must use strict `=== false` — `undefined` and `true` must both proceed to send
- T005 `resolveCta` is a pure function — no Inngest, no email SDK; test it directly without mocks
- T007 replaces the existing `{customerEmail && <CTAButton>}` block — do not leave both code paths
- T008 tests belong in the existing `templates.test.ts` file as a new `describe` block — do not create a new file
- T009/T010 belong in the existing `form-notification.test.ts` — add to existing `send-email` describe blocks
- No DB migration, no new packages, no new files beyond test additions
