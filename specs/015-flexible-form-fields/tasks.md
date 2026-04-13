# Tasks: Flexible Form Notification Fields (015)

**Input**: Design documents from `specs/015-flexible-form-fields/`  
**Branch**: `015-flexible-form-fields`  
**Prerequisites**: plan.md ✓ spec.md ✓ research.md ✓ data-model.md ✓ contracts/ ✓ quickstart.md ✓

**Tests**: Included — plan.md specifies test file changes as part of implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Update the shared event payload type — every other task depends on this being correct first.

**⚠️ CRITICAL**: No user story work can begin until T001 is complete.

- [x] T001 Update `FormSubmittedPayload` in `src/types/index.ts`: make `submitterName`, `submitterEmail`, `submitterMessage` optional (`?`); add `submitterPhone?: string`, `submittedFrom?: string`, `formName?: string`, `customFields?: Record<string, string>`; annotate `formId` with `@deprecated Use formName instead. Silently ignored by the notification service.`

**Checkpoint**: Type compiles — all existing call sites still typecheck because previously required fields are now optional (structurally compatible).

---

## Phase 3: User Story 1 — Email-Only Form Submission (Priority: P1) 🎯 MVP

**Goal**: A payload containing only `clientId` (and optionally `submitterEmail`) triggers a valid notification email without errors.

**Independent Test**: Fire `form/submitted` with `{ clientId: "...", submitterEmail: "jane@example.com" }` via the Inngest Dev Server. Verify a notification email is delivered and the email contains exactly one field row (Email) with no blank sections.

### Implementation

- [x] T002 [US1] Reduce `REQUIRED_FIELDS` to `["clientId"]` only in `src/inngest/functions/form-notification.ts` (remove `submitterName`, `submitterEmail`, `submitterMessage` from the array)

- [x] T003 [US1] In `src/emails/templates/sales-lead-v1.tsx`: update `InquiryEmailProps` to mark `customerName`, `customerEmail`, and `comments` as optional (`?`) — these were previously required string fields

- [x] T004 [US1] In `src/emails/templates/sales-lead-v1.tsx`: rewrite the `fields` array construction to conditionally include only present standard fields — spread-in each field only when its value is a non-empty string (pattern: `...(customerName ? [{ label: 'Name', value: customerName }] : [])` etc.); also guard `{fields.length > 0 && <FieldGroup fields={fields} />}` to suppress the group when empty (depends on T003)

- [x] T005 [US1] In `src/emails/templates/sales-lead-v1.tsx`: wrap the `<CTAButton>` in a conditional that renders it only when `customerEmail` is present; update the button label to `customerName ? \`Reply to ${customerName}\` : 'Reply'` (depends on T003)

- [x] T006 [US1] In `src/lib/templates.ts` — `renderFormNotificationEmail()`: update `previewText` to fall back gracefully when `submitterName` is absent: use name if present, else email, else `"New inquiry — ${client.name}"`; update `subject` to use `formName` (not `formId`): `payload.formName ? \`New form submission: ${payload.formName} — ${client.name}\` : \`New inquiry — ${client.name}\`` (depends on T001)

- [x] T007 [P] [US1] In `tests/unit/inngest/functions/form-notification.test.ts`: update the `validate-payload` describe block — rename the success test to "succeeds when clientId is present"; remove the "throws when submitterEmail is missing" test (email no longer required); keep "throws when clientId is missing"; add "succeeds with only clientId (no optional fields)" using a cloned engine with `data: { clientId: "client-acme" }`; add "succeeds with clientId + submitterEmail only" (depends on T002)

- [x] T008 [P] [US1] In `tests/unit/lib/templates.test.ts`: add a `describe("renderFormNotificationEmail")` block; add test "renders generic subject when formName is absent" (payload with no formName → subject contains "New inquiry"); add test "uses submitterEmail in previewText when name is absent" (payload with email but no name); add test "uses generic previewText when both name and email are absent" (payload with only clientId) (depends on T006)

**Checkpoint**: `npm test` passes. Fire a minimal payload in Dev Server — email delivers, no blank rows, no CTA button crash.

---

## Phase 4: User Story 2 — Submitted From Field (Priority: P2)

**Goal**: When `submittedFrom` is included in the payload, the notification email displays it as the "Source Page" field. When absent, no Source Page section appears.

**Independent Test**: Fire `form/submitted` with `{ clientId: "...", submitterEmail: "jane@example.com", submittedFrom: "/contact" }`. Verify the notification email contains a "Source Page" row showing `/contact`.

### Implementation

- [x] T009 [US2] In `src/lib/templates.ts` — `renderFormNotificationEmail()`: pass `sourcePageLink: payload.submittedFrom` and `sourcePageText: payload.submittedFrom` to `SalesLeadV1Email` (the template already renders these conditionally — this task wires the payload field through) (depends on T006)

- [x] T010 [US2] In `tests/unit/lib/templates.test.ts`: add test "passes submittedFrom as sourcePageLink to SalesLeadV1Email" — assert `mockRender` (or the mock for `SalesLeadV1Email`) was called with `sourcePageLink: "/contact"` and `sourcePageText: "/contact"` when payload includes `submittedFrom: "/contact"`; add test "does not pass sourcePageLink when submittedFrom is absent" (depends on T009)

**Checkpoint**: Trigger payload with `submittedFrom` → Source Page appears. Trigger without it → no Source Page section.

---

## Phase 5: User Story 3 — Full Standard Field Set (Priority: P3)

**Goal**: All six standard optional fields (`submitterName`, `submitterEmail`, `submitterPhone`, `submitterMessage`, `submittedFrom`, `formName`) render correctly when present; none produce blank rows when absent.

**Independent Test**: Fire `form/submitted` with all six standard fields populated. Verify the notification email contains exactly six rows and a subject line of `New form submission: <formName> — <Client Name>`.

### Implementation

- [x] T011 [US3] In `src/lib/templates.ts` — `renderFormNotificationEmail()`: add `customerPhone: payload.submitterPhone` to the `SalesLeadV1Email` props (the template already handles this conditionally) (depends on T009)

- [x] T012 [US3] In `src/lib/templates.ts` — `renderFormNotificationEmail()`: add `interestedIn: payload.formName` to the `SalesLeadV1Email` props (template renders it as "Interested In" field); verify the subject line already uses `payload.formName` (set in T006 — confirm, do not re-add) (depends on T011)

- [x] T013 [P] [US3] In `tests/unit/lib/templates.test.ts`: add test "passes submitterPhone as customerPhone"; add test "passes formName as interestedIn"; add test "renders subject with formName when present" (subject contains "New form submission: Quote Request — Acme Corp") (depends on T012)

**Checkpoint**: Full payload test: all six rows present in email, correct subject, no blank sections.

---

## Phase 6: User Story 4 — Custom Fields (Priority: P4)

**Goal**: A `customFields` map is accepted in the payload and rendered as additional labelled rows after standard fields. An empty or absent `customFields` produces no extra rows.

**Independent Test**: Fire `form/submitted` with `{ clientId: "...", customFields: { "Project Budget": "$5k", "Timeline": "3 months" } }`. Verify the notification email contains two additional rows with those exact labels and values.

### Implementation

- [x] T014 [US4] In `src/emails/templates/sales-lead-v1.tsx`: add `customFields?: Record<string, string>` to `InquiryEmailProps` and add `customFields` to the destructured props in the component function (depends on T005)

- [x] T015 [US4] In `src/emails/templates/sales-lead-v1.tsx`: after building the standard `fields` array, append custom field entries — convert `Object.entries(customFields ?? {})` where value is non-empty into `{ label: k, value: v }` objects and spread them into the `fields` array (React JSX escapes string content, satisfying the HTML-injection requirement automatically) (depends on T014)

- [x] T016 [US4] In `src/lib/templates.ts` — `renderFormNotificationEmail()`: pass `customFields: payload.customFields` to `SalesLeadV1Email` (depends on T012, T015)

- [x] T017 [P] [US4] In `tests/unit/lib/templates.test.ts`: add test "passes customFields through to SalesLeadV1Email" — assert template mock called with `customFields: { "Project Budget": "$5k" }`; add test "passes undefined when customFields is absent"; add test "passes empty object when customFields is `{}`" (depends on T016)

**Checkpoint**: Custom-fields payload test: two extra rows present, correct labels and values, no extra rows when absent.

---

## Phase 7: Polish & Validation

**Purpose**: Confirm type safety, test suite integrity, and build cleanliness across all stories.

- [x] T018 [P] Run `npm run type-check` from repo root and resolve any type errors introduced by the `FormSubmittedPayload` changes or template prop changes in `src/emails/templates/sales-lead-v1.tsx`

- [x] T019 [P] Run `npm test` from repo root and confirm all unit tests pass — pay specific attention to the `form-notification` and `templates` suites updated in T007, T008, T010, T013, T017

- [x] T020 Run `npm run build` and confirm TypeScript compilation to `dist/` succeeds with zero errors (depends on T018, T019)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2 — T001)**: No dependencies — start immediately
- **US1 (Phase 3 — T002–T008)**: All depend on T001
- **US2 (Phase 4 — T009–T010)**: Depends on T006 (part of US1)
- **US3 (Phase 5 — T011–T013)**: Depends on T009 (part of US2)
- **US4 (Phase 6 — T014–T017)**: T014–T015 depend on T005 (US1); T016 depends on T012 (US3) + T015
- **Polish (Phase 7 — T018–T020)**: Depends on all implementation tasks complete

### Within Each User Story

- T003 → T004 → T005 (all in `sales-lead-v1.tsx`, sequential)
- T006 → T009 → T011 → T012 (all in `templates.ts` `renderFormNotificationEmail()`, sequential)
- T007 and T008 are independent of each other [P] once their prerequisites are met
- T014 → T015 (sequential in `sales-lead-v1.tsx`)

### Parallel Opportunities

Within US1 (once T001–T006 are done):
- T007 (`form-notification.test.ts`) and T008 (`templates.test.ts`) can run in parallel

Within US3 (once T012 is done):
- T013 (`templates.test.ts`) can run in parallel with any non-conflicting work

Within US4 (once T016 is done):
- T017 (`templates.test.ts`) can run in parallel with T018/T019

---

## Parallel Example: User Story 1

```bash
# After T006 is complete, these two test tasks can run simultaneously:
Task T007: Update validate-payload tests in tests/unit/inngest/functions/form-notification.test.ts
Task T008: Add minimal-payload rendering tests in tests/unit/lib/templates.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 (Foundational)
2. Complete T002–T006 (US1 implementation)
3. Complete T007–T008 in parallel (US1 tests)
4. **STOP and VALIDATE**: `npm test` passes; fire minimal payload in Dev Server
5. US1 is shippable — a payload with only `clientId` works

### Incremental Delivery

1. T001 → Foundation set
2. T002–T008 → US1 done → minimal payloads work (MVP)
3. T009–T010 → US2 done → `submittedFrom` appears in emails
4. T011–T013 → US3 done → all six standard fields render
5. T014–T017 → US4 done → custom fields work
6. T018–T020 → Polish complete → ready to merge

---

## Notes

- All six modified files are in the existing codebase — no new files created
- No new packages, no database migrations
- Backward compat is automatic: previously required fields are now optional in the type and still accepted + rendered identically when present
- `formId` stays in the type with `@deprecated` JSDoc; no runtime removal needed
- React JSX string escaping satisfies FR-008 (HTML injection prevention) at no extra cost
