# Tasks: Form Submission Notification

**Input**: Design documents from `/specs/003-form-notification/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: No automated tests requested. Verification is manual via Inngest Dev UI and `npm run test:form`.

**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- **No story label**: Setup or foundational task

---

## Phase 1: Setup

**Purpose**: No new directories required. All files fit the existing structure from 002.

> Nothing to do — skip to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Add the shared event payload type used by the workflow function and any future callers.

**⚠️ CRITICAL**: Must be complete before Phase 3 can begin.

- [X] T001 Add `FormSubmittedPayload` interface to `src/types/index.ts` extending `BaseEventPayload` with fields: `submitterName: string`, `submitterEmail: string`, `submitterMessage: string`, `formId?: string`

**Checkpoint**: `npm run type-check` passes — Phase 3 can begin.

---

## Phase 3: User Story 1 + 2 — Notification Delivery & Diagnosable Failures (P1 + P2) 🎯 MVP

**Goal**: A complete, registered workflow function that delivers form notification emails and surfaces failures clearly in the Inngest dashboard.

**Why combined**: US2 (diagnosable failures) is implemented entirely within the same function as US1 — the `validate-payload` step serves US2 and the `send-email` step serves US1. There is no separate file or service.

**Independent Test**: With `npm run dev` running, send the test event via the Inngest Dev UI. Verify the run completes with 4 named steps and the mock email preview opens in the browser. Then send a bad event (unknown `clientId`) and verify the run fails with a clear error message visible in the dashboard — no log inspection required.

### Implementation

- [X] T002 [US1] Create `src/inngest/functions/form-notification.ts` with the complete `sendFormNotification` function:
  - Function definition: `id: "send-form-notification"`, `retries: 3`, trigger: `{ event: "form/submitted" }`
  - `step.run("validate-payload")` — check `clientId`, `submitterName`, `submitterEmail`, `submitterMessage` are non-empty; throw `Missing required field: <name>` for each missing field [**US2**]
  - `step.run("fetch-client-config")` — call `getClientById(clientId)`; propagate "Client not found" / "Client inactive" errors as-is [**US2**]
  - `step.run("send-email")` — build inline HTML body with submitter name, email, message, `formId ?? "Unknown form"`, and received timestamp; call `sendEmail({ to: client.email, subject: \`New form submission: ${formId ?? "Unknown form"}\`, html })`
  - `step.run("log-result")` — log outcome with `clientId`, `mode`, `outcome`
  - Log `config.env` and `clientId` at function start
  - Export as `sendFormNotification`

- [X] T003 [US1] Register `sendFormNotification` in `src/inngest/functions/index.ts` — import and add to the `functions` array

**Checkpoint**: US1 + US2 complete. `npm run dev` → send `form/submitted` event → 4 named steps complete → mock email preview opens. Send bad clientId → run fails with clear error in dashboard.

---

## Phase 4: User Story 3 — External Event Triggering (P3)

**Goal**: A one-command test script so developers can trigger the full workflow from the terminal without opening the Inngest Dev UI.

**Independent Test**: With `npm run dev` running in another terminal, run `npm run test:form`. Verify the workflow run appears in the Inngest Dev UI and completes successfully.

### Implementation

- [X] T004 [P] [US3] Create `scripts/test-form-notification.ts` — use `fetch` to POST a `form/submitted` event to `http://localhost:8288/e/local` with payload: `clientId: "client-acme"`, `submitterName: "Jane Smith"`, `submitterEmail: "jane@example.com"`, `submitterMessage: "Hi, I'd like a quote."`, `formId: "contact"`. Log the response status.

- [X] T005 [P] [US3] Add `"test:form": "tsx --env-file .env.local scripts/test-form-notification.ts"` to `package.json` scripts

**Checkpoint**: `npm run test:form` sends event → run visible in Inngest Dev UI → completes with mock email preview.

---

## Phase 5: Polish

- [X] T006 Run `npm run type-check` — resolve any TypeScript errors before marking complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1+US2 (Phase 3)**: Depends on T001 (type must exist)
- **US3 (Phase 4)**: T004 and T005 are [P] — can run in parallel with each other; depend on T003 (function must be registered before testing)
- **Polish (Phase 5)**: Depends on all prior phases complete

### Task Dependency Chain

```
T001 → T002 → T003 → T004 [P]
                    → T005 [P]
                           ↓
                          T006
```

### Parallel Opportunities

- T004 and T005 can run in parallel (different files — scripts/ and package.json)
- Phase 3 and Phase 4 are sequential by necessity (can't test what isn't registered)

---

## Implementation Strategy

### MVP (User Stories 1 + 2 only)

1. T001 — Add type
2. T002 — Create function
3. T003 — Register function
4. **STOP and VALIDATE**: `npm run dev` → send event in Inngest Dev UI → verify 4 steps complete + mock email preview opens → verify bad clientId shows clear error in dashboard

### Full Delivery (add US3)

5. T004 + T005 — Test script and npm command
6. T006 — Type-check

---

## Notes

- Total tasks: **6**
- Tasks per story: US1+US2 = 2 implementation tasks (T002, T003) | US3 = 2 tasks (T004, T005)
- Parallel opportunities: T004 + T005
- This is the smallest possible implementation — 1 new function file, 1 type extension, 1 index update, 1 test script
- No new packages, no new DB tables, no new directories
