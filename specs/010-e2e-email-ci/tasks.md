# Tasks: Automated End-to-End Email Testing in CI

**Input**: Design documents from `specs/010-e2e-email-ci/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Install dependencies, create directory structure, configure test runner

- [x] T001 Add `@mailtrap/mailtrap-client` to devDependencies and add `test:e2e` script to `package.json`
- [x] T002 Create `tests/e2e/email/helpers/` directory structure (empty directories + `.gitkeep` if needed)
- [x] T003 Create `vitest.e2e.config.ts` at repo root — include `tests/e2e/**/*.test.ts`, set `testTimeout: 120000` (2 min per test to allow Inngest + email delivery)
- [x] T004 Add e2e environment variables to `.env.example`: `PREVIEW_URL`, `INNGEST_EVENT_KEY_STAGING`, `INNGEST_SIGNING_KEY_STAGING`, `MAILTRAP_API_TOKEN`, `MAILTRAP_ACCOUNT_ID`, `MAILTRAP_INBOX_ID`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared helpers and flow config that ALL user story phases depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `tests/e2e/email/helpers/mailtrap.ts` — export `waitForEmail(subjectPattern: RegExp, triggeredAt: Date, timeoutMs?: number): Promise<MailtrapMessage>` that polls `GET /api/accounts/{accountId}/inboxes/{inboxId}/messages`, filters by `created_at >= triggeredAt` and subject regex, throws descriptive error on timeout
- [x] T006 Create `tests/e2e/email/helpers/inngest.ts` — export `triggerFlow(eventName: string, data: object): Promise<string>` that POSTs to `https://inn.gs/e/:INNGEST_EVENT_KEY_STAGING` and returns `eventId`; export `waitForRunCompletion(eventId: string, timeoutMs?: number): Promise<InngestRun>` that polls `GET https://api.inngest.com/v1/events/:eventId/runs` with signing key until status is `Completed`, `Failed`, or `Cancelled`, throwing descriptive error on timeout or failure
- [x] T007 Create `tests/e2e/email/flow-map.ts` — export `FLOW_MAP` with initial `weekly-analytics` entry (`patterns`, `event: "sol/weekly.analytics.report.requested"`, `eventData: { clientId: "test-seed-client" }`, `testFile`) and export `SHARED_PATTERNS` array (`src/lib/email.ts`, `src/lib/config.ts`, `src/inngest/functions/index.ts`, `src/types/index.ts`)

**Checkpoint**: Helpers and flow map ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Basic End-to-End Pipeline Loop (Priority: P1) 🎯 MVP

**Goal**: Prove the full loop works — trigger Inngest weekly analytics workflow against a Preview deployment, email arrives in Mailtrap, basic assertions pass, and a defect causes the test to fail.

**Independent Test**: Run `PREVIEW_URL=<preview-url> npm run test:e2e -- --reporter=verbose` against a live Preview deployment and verify the test passes. Then introduce a deliberate defect (remove a section from the email template), redeploy, and verify the test fails with a descriptive message.

- [x] T008 [US1] Create `tests/e2e/email/weekly-analytics.test.ts` — `beforeAll`: record `triggeredAt = new Date()`, call `triggerFlow` from `inngest.ts`, call `waitForRunCompletion`; `afterAll`: clear nothing (timestamp isolation handles concurrent runs); expose `email` as a shared variable for all assertions
- [x] T009 [US1] Add subject assertion to `tests/e2e/email/weekly-analytics.test.ts` — assert `email.subject` matches `/\[TEST:.*\] Weekly Analytics/i`
- [x] T010 [US1] Add HTML body presence assertions to `tests/e2e/email/weekly-analytics.test.ts` — assert `email.html_body` includes expected section markers (e.g. presence of analytics summary container, report period text)
- [ ] T011 [US1] Manual validation: run `npm run test:e2e` against a live Preview URL, confirm green pass; then open a PR that removes a section from the analytics email template and confirm the test catches it

**Checkpoint**: US1 complete — basic pipeline loop proven end-to-end with a real Preview deployment

---

## Phase 4: User Story 2 — Dynamic Field Assertions (Priority: P2)

**Goal**: Extend the weekly analytics test to verify that personalised fields are populated — client name, metrics, and report period are real values, not blank, null, or raw template syntax.

**Independent Test**: With the seed test client's data in staging DB, run `npm run test:e2e` and verify all dynamic field assertions pass. Then insert a deliberately blank metric into staging and verify the test catches it.

- [x] T012 [US2] Add dynamic field assertions to `tests/e2e/email/weekly-analytics.test.ts` — assert `email.html_body` does NOT contain `{{`, `undefined`, or `null` as literal strings (raw template / serialisation leakage check)
- [x] T013 [US2] Add populated-value assertions to `tests/e2e/email/weekly-analytics.test.ts` — assert that at least one numeric metric value appears in the body (regex `/\d+/`), confirming analytics data was fetched and rendered rather than defaulting to empty

**Checkpoint**: US1 + US2 complete — assertions cover both delivery and content correctness

---

## Phase 5: User Story 3 — Selective Execution by Changed Files (Priority: P2)

**Goal**: GitHub Actions workflow runs only the relevant flow test(s) based on which files changed in the PR. PRs with no email-related changes skip the suite entirely without blocking the PR.

**Independent Test**: (a) Open a PR touching only `src/inngest/functions/weekly-analytics-report.ts` → confirm only `e2e-weekly-analytics` job runs. (b) Open a PR touching only `src/inngest/functions/form-notification.ts` → confirm only `e2e-form-notification` job runs. (c) Open a PR touching `src/lib/email.ts` → confirm both jobs run. (d) Open a PR touching only `README.md` → confirm `ci-gate` passes with all flow jobs skipped.

- [x] T014 [US3] Create `.github/workflows/e2e-email.yml` — `on: pull_request` trigger; `detect-changes` job using `dorny/paths-filter@v3` with filter groups: `weekly-analytics` (patterns from `flow-map.ts`), `form-notification` (patterns from `flow-map.ts`), `shared` (patterns from `SHARED_PATTERNS`); output boolean flags for each group
- [x] T015 [US3] Add `wait-for-deployment` job to `.github/workflows/e2e-email.yml` — depends on `detect-changes`; runs only `if: needs.detect-changes.outputs.weekly-analytics == 'true' || needs.detect-changes.outputs.form-notification == 'true' || needs.detect-changes.outputs.shared == 'true'`; uses `patrickedqvist/wait-for-vercel-preview@v1.3.1` with `token: ${{ secrets.GITHUB_TOKEN }}` and `max_timeout: 180`; outputs the preview `url`
- [x] T016 [US3] Add `e2e-weekly-analytics` job to `.github/workflows/e2e-email.yml` — `if: needs.detect-changes.outputs.weekly-analytics == 'true' || needs.detect-changes.outputs.shared == 'true'`; sets env vars from GitHub secrets + `PREVIEW_URL` from `wait-for-deployment` output; runs `npm run test:e2e -- --reporter=github`
- [x] T017 [US3] Add `form-notification` entry to `tests/e2e/email/flow-map.ts` — `event: "sol/form.submitted"`, `eventData: { clientId: "test-seed-client", ... }`, `testFile: "form-notification.test.ts"`
- [x] T018 [P] [US3] Create `tests/e2e/email/form-notification.test.ts` — same structure as `weekly-analytics.test.ts`: `beforeAll` triggers form notification workflow, `waitForRunCompletion`, `waitForEmail`; assertions: subject matches `[TEST:]`, body contains form submission confirmation content, no raw template syntax
- [x] T019 [US3] Add `e2e-form-notification` job to `.github/workflows/e2e-email.yml` — `if: needs.detect-changes.outputs.form-notification == 'true' || needs.detect-changes.outputs.shared == 'true'`; same secrets + env var pattern as `e2e-weekly-analytics`
- [x] T020 [US3] Add `ci-gate` job to `.github/workflows/e2e-email.yml` — `needs: [e2e-weekly-analytics, e2e-form-notification]`; `if: always()`; step uses `jq` to assert all upstream results are `success` or `skipped`: `echo '${{ toJSON(needs) }}' | jq -e '[.[] | .result] | all(. == "success" or . == "skipped")'`

**Checkpoint**: US3 complete — selective execution working; ci-gate correctly skips or passes based on changed files

---

## Phase 6: User Story 4 — Zero Manual Steps (Priority: P3)

**Goal**: Validate the fully automated end-to-end experience — open a PR and receive a result on the PR without any manual action.

**Independent Test**: Open a PR with a trivial change (e.g., a comment in an email template file), push to GitHub, and observe the full pipeline execute automatically — `detect-changes` → `wait-for-deployment` → `e2e-weekly-analytics` → `ci-gate` — and post a status check result on the PR, without visiting any external dashboard.

- [ ] T021 [US4] Open a test PR touching an analytics email file and verify the full pipeline runs automatically end-to-end and `ci-gate` status check appears on the PR
- [ ] T022 [US4] Open a test PR with no email-related file changes and verify `ci-gate` passes immediately with all flow jobs showing as skipped — PR is not blocked

**Checkpoint**: All four user stories complete — pipeline is fully automated and selective

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 Set `ci-gate` as the only required status check in GitHub branch protection for `main` (Settings → Branches → Branch protection rules)
- [x] T024 Update `CLAUDE.md` — add note that `tests/e2e/email/flow-map.ts` is the registration point for new e2e flows; new email workflows must add an entry there alongside the Inngest function
- [x] T025 Add constitution PATCH amendment to `.specify/memory/constitution.md` — add `@mailtrap/mailtrap-client` to Technology Stack table as a devDependency; bump version to 1.1.1 and update `Last Amended` date

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3/US4
- **US2 (Phase 4)**: Depends on US1 test file existing (extends it) — otherwise independent
- **US3 (Phase 5)**: Depends on Foundational; T018 can run in parallel with T014–T016; T017/T019/T020 depend on T014
- **US4 (Phase 6)**: Depends on US3 complete (CI workflow must exist)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **US2 (P2)**: Extends US1 test file — start after T008 is complete
- **US3 (P2)**: Can start after Phase 2 in parallel with US1/US2
- **US4 (P3)**: Depends on US3 complete

### Parallel Opportunities

- T005, T006, T007 (Phase 2) — all different files, run in parallel
- T009, T010 (Phase 3) — both add to same test file, run sequentially after T008
- T014, T018 (Phase 5) — different files, run in parallel
- T023, T024, T025 (Phase 7) — all different files, run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All three foundational files are independent — implement simultaneously:
Task T005: tests/e2e/email/helpers/mailtrap.ts
Task T006: tests/e2e/email/helpers/inngest.ts
Task T007: tests/e2e/email/flow-map.ts
```

## Parallel Example: Phase 5 (US3)

```bash
# CI workflow scaffolding and second flow test file are independent:
Task T014: .github/workflows/e2e-email.yml (initial scaffold)
Task T018: tests/e2e/email/form-notification.test.ts
# Then complete T015–T017, T019–T020 sequentially to build out the workflow
```

---

## Implementation Strategy

### MVP (US1 Only — Phases 1–3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational helpers + flow map
3. Complete Phase 3: US1 — weekly analytics test file
4. **STOP and VALIDATE**: Run `npm run test:e2e` against a real Preview URL — confirm pass
5. Introduce deliberate defect, rerun — confirm fail with descriptive message

At this point you have a working manual e2e test. Everything from Phase 4 onward automates and extends it.

### Incremental Delivery

1. Phases 1–3 → Manual e2e test working (MVP)
2. Phase 4 → Richer assertions (dynamic fields)
3. Phase 5 → Full CI automation with selective execution
4. Phase 6 → Validated automated experience on real PRs
5. Phase 7 → Branch protection enforced, docs complete

---

## Notes

- `[P]` tasks target different files with no blocking dependencies
- `[Story]` label maps each task to a specific user story for traceability
- The `waitForEmail` timestamp window (T005) is the key isolation mechanism for concurrent PR runs — implemented once, used by all flow test files
- `ci-gate` (T020) is the only job that should be set as a required status check — never the individual flow jobs
- When adding a new email flow in future: add entry to `flow-map.ts`, create `<flow>.test.ts`, add path filter + conditional job to the workflow — three files, no other changes needed
