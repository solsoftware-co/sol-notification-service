# Feature Specification: Automated End-to-End Email Testing in CI

**Feature Branch**: `010-e2e-email-ci`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "Automated end-to-end email testing pipeline: on every PR, trigger Inngest workflow functions against the Vercel Preview deployment, deliver emails to a test mailbox, and run automated UI tests against the delivered email content to verify rendering and correctness before merging."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Catch a broken email before it reaches clients (Priority: P1)

A developer opens a pull request with changes to the weekly analytics email template. Without any manual intervention, the CI pipeline runs the workflow against the preview environment, delivers the email to a test inbox, and verifies the content matches expectations. If the email is broken — wrong data, missing sections, broken layout — the PR check fails and the developer is alerted before the code reaches production.

**Why this priority**: This is the core value of the feature. The entire pipeline exists to prevent broken emails from reaching real clients. Everything else supports this outcome.

**Independent Test**: Can be fully tested by opening a PR that introduces a deliberate email defect (e.g., removing a required section), and verifying the CI check fails with a meaningful error pointing to the email issue.

**Acceptance Scenarios**:

1. **Given** a developer opens a PR, **When** the Vercel Preview deployment completes, **Then** the CI pipeline automatically triggers the email workflow against that preview environment — no manual steps required.
2. **Given** the workflow runs in the preview environment, **When** it completes, **Then** an email is delivered to the test inbox within 90 seconds of the workflow being triggered.
3. **Given** an email arrives in the test inbox, **When** the automated tests run, **Then** each test asserts specific content (subject line, key sections, recipient format) and reports a pass or fail result visible on the PR.
4. **Given** a test assertion fails, **When** the developer views the PR, **Then** the failing check clearly identifies which assertion failed (e.g., "missing analytics summary section") so they can diagnose without inspecting logs manually.

---

### User Story 2 — Verify email renders correctly for each client (Priority: P2)

A developer needs confidence that personalised email content is rendered correctly — that client-specific data (e.g., analytics metrics, client name) actually appears in the email and is not blank or defaulting to placeholder values.

**Why this priority**: Email personalisation bugs are subtle and hard to catch in unit tests. An end-to-end check that the email content is populated correctly (not just that it was delivered) prevents silent data-rendering failures from reaching clients.

**Independent Test**: Can be fully tested by asserting that specific dynamic fields (e.g., a client name or a non-zero metric) are present in the delivered email HTML.

**Acceptance Scenarios**:

1. **Given** the workflow runs for a test client, **When** the email is delivered, **Then** the automated tests verify that dynamic content fields are populated — not blank, null, or showing placeholder text.
2. **Given** the email HTML is inspected, **When** tests check the visual structure, **Then** all required sections are present and no broken layout markers (e.g., unclosed tags, raw template syntax) are detected.

---

### User Story 3 — Only test the flows that were actually changed (Priority: P2)

A developer changes the form notification email template. The pipeline detects that only form-notification-related files were modified and runs only the form notification e2e test — not the weekly analytics test. The PR check completes faster and the result is scoped to the change.

**Why this priority**: Running all email flows on every PR regardless of what changed is wasteful and slows down the feedback loop. It also produces noise — a developer fixing a form notification bug should not see a failing analytics email test unless they broke analytics. Selective execution keeps results focused and meaningful.

**Independent Test**: Can be fully tested by opening a PR that touches only one email flow's files and verifying the pipeline triggers and reports results only for that flow — with a skipped or absent result for unrelated flows.

**Acceptance Scenarios**:

1. **Given** a PR modifies only files belonging to a single email flow, **When** the pipeline runs, **Then** only the e2e test suite for that flow is triggered — other flows are not tested and do not appear as failures.
2. **Given** a PR modifies shared infrastructure used by all email flows (e.g., the core email sending module), **When** the pipeline runs, **Then** all email flow test suites are triggered.
3. **Given** a PR modifies no email-related files at all, **When** the pipeline evaluates the changeset, **Then** the e2e email tests are skipped entirely and the PR is not blocked by a missing test result.
4. **Given** a PR modifies files belonging to multiple distinct email flows, **When** the pipeline runs, **Then** each affected flow's test suite runs independently and reports its own pass/fail result.

---

### User Story 4 — Zero manual steps to run the test suite on a PR (Priority: P3)

A developer opens a PR and the entire test pipeline — deploy, trigger, wait, assert — runs automatically and posts results back to the PR without the developer needing to visit the Inngest dashboard, trigger functions manually, or check a separate inbox.

**Why this priority**: Manual testing steps break the feedback loop and create toil. The value of the pipeline degrades quickly if developers must remember to run it or interpret results from multiple dashboards.

**Independent Test**: Can be fully tested by opening a PR with a trivial change and verifying that CI runs end-to-end automatically and posts a status check result to the PR.

**Acceptance Scenarios**:

1. **Given** a PR is opened or updated, **When** the Vercel Preview deployment succeeds, **Then** CI automatically proceeds to trigger the workflow and run assertions — no developer action required.
2. **Given** the test suite completes (pass or fail), **When** the developer views the PR, **Then** a single status check summarises the result — no need to navigate external dashboards to understand the outcome.

---

### Edge Cases

- What happens when the Vercel Preview deployment fails? The pipeline must not attempt to trigger the workflow and must report a clear "deployment not ready" status on the PR rather than a confusing test failure.
- What happens when the Inngest workflow times out or never completes? The pipeline must time out gracefully (not hang indefinitely) and report a "workflow did not complete" failure on the PR.
- What happens when no email is delivered to the test inbox within the expected window? The test must fail with a "email not received within timeout" message, not a generic assertion error.
- What happens when the test client used in CI has no real analytics data? The pipeline must use mock or seed data so the workflow always produces a deterministic email regardless of live data availability.
- What happens when multiple PRs run the pipeline concurrently? Each PR's test run must use an isolated test inbox or correlation identifier so emails from one run do not interfere with assertions in another.
- What happens when a PR changes a shared module used by all email flows (e.g., the core email sending utility)? The pipeline must recognise the shared dependency and run all flow test suites, not just one.
- What happens when a PR changes no email-related files? The pipeline must skip gracefully and not block the PR with a required-but-missing check.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI pipeline MUST trigger automatically when a pull request is opened or updated with a new commit — no manual steps required from the developer.
- **FR-002**: The pipeline MUST wait for the Vercel Preview deployment to reach a ready state before proceeding to trigger any workflow.
- **FR-003**: The pipeline MUST send a trigger event to the Inngest staging environment targeting the Preview deployment URL for that PR.
- **FR-004**: The triggered workflow MUST deliver its output email to an isolated test inbox that is accessible to the CI pipeline via an API.
- **FR-005**: The pipeline MUST wait for the email to arrive in the test inbox, with a maximum wait time of 90 seconds before reporting a failure.
- **FR-006**: The automated tests MUST assert on the email subject line, confirming it matches the expected format including the test-mode prefix.
- **FR-007**: The automated tests MUST assert on the email HTML body, confirming all required sections are present (e.g., analytics summary, client name, report period).
- **FR-008**: The automated tests MUST assert that dynamic content fields are populated — not blank, null, or containing raw template syntax.
- **FR-009**: The pipeline MUST post a pass or fail status check to the PR with a human-readable summary of which assertions failed, if any.
- **FR-010**: Each PR run MUST use an isolated test inbox or include a per-run correlation identifier so concurrent PR runs do not produce false positives or negatives.
- **FR-011**: The pipeline MUST fail gracefully with a distinct, descriptive error message on the PR for each failure mode: Vercel deployment failed, Inngest workflow did not complete, or no email received within timeout.
- **FR-012**: The pipeline MUST operate entirely within the free tiers of the services it depends on at current PR volume (single-digit active PRs per day).
- **FR-013**: The pipeline MUST inspect the set of files changed in the PR and determine which email flows are affected before triggering any workflow.
- **FR-014**: The pipeline MUST only trigger the test suite(s) for email flows whose associated files were changed — unaffected flows MUST NOT be triggered or reported as failures.
- **FR-015**: The pipeline MUST recognise shared email infrastructure files (e.g., the core email sending module, shared templates) as affecting all flows — when such files change, all flow test suites MUST run.
- **FR-016**: When a PR contains no changes to email-related files, the pipeline MUST skip the e2e email tests entirely and MUST NOT block the PR with a missing or failed check.

### Key Entities

- **PR Pipeline Run**: A single execution of the automated test suite triggered by a PR event. Has a lifecycle: waiting for deployment → triggering workflow → waiting for email → asserting → reporting.
- **Test Inbox**: An isolated email inbox used exclusively by the CI pipeline to receive workflow-generated emails. Must support programmatic access for reading and asserting on delivered messages.
- **Email Assertion**: A specific check applied to a delivered email (subject match, body section presence, dynamic field population). The atomic unit of test reporting.
- **Preview Deployment**: The non-production deployment of the application created automatically for a given PR. The pipeline targets this environment exclusively — production is never contacted.
- **Email Flow**: A named, end-to-end email journey (e.g., weekly analytics report, form notification). Each flow has a defined set of associated source files and a corresponding test suite. The pipeline uses the changed file list to determine which flows are in scope for a given PR.
- **Shared Infrastructure**: Source files that affect all email flows regardless of which flow is being changed (e.g., the core email sending module, shared layout templates). Changes to shared infrastructure trigger all flow test suites.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer receives a pass/fail result on their email tests within 3 minutes of the Vercel Preview deployment completing — with no manual steps taken.
- **SC-002**: 100% of PRs that modify email-related code are validated by at least one automated email assertion run before merging — enforced by an automated gate on the PR that blocks merge until the check passes.
- **SC-003**: When an email defect is introduced (missing section, blank dynamic field, wrong subject), the automated check fails and surfaces the specific failing assertion on the PR — developers do not need to inspect external logs to understand what broke.
- **SC-004**: The pipeline runs without incurring costs beyond the free tiers of all dependent services, confirmed by monitoring usage dashboards over the first 30 days after launch.
- **SC-005**: Concurrent PR runs (two or more open simultaneously) produce independent, accurate results — each run's assertions reflect only that run's email output with no cross-contamination.
- **SC-006**: A PR that changes only one email flow completes its e2e test check at least 50% faster than a full run of all flows — confirming selective execution is working and not running unnecessary tests.
- **SC-007**: A PR that changes no email-related files passes the automated gate immediately without waiting for any workflow to complete — developers are never blocked by irrelevant tests.

## Assumptions

- **Test client**: A stable seed test client exists in the staging database whose analytics data is either mocked or sourced from a non-production property, ensuring the workflow always produces a deterministic email in CI.
- **Inngest staging environment**: A separate Inngest environment (distinct from production) is already configured and connected to Vercel Preview deployments via the Inngest Vercel integration established in feature 009.
- **Email redirect in Preview**: The application already routes all emails to `TEST_EMAIL` when running in preview mode (established in feature 002). The test inbox address will be set as `TEST_EMAIL` in Vercel's Preview environment variables.
- **PR volume**: Single-digit PRs per day, well within the free tier of the test inbox service.
- **Single client per run**: Each PR pipeline run triggers the workflow for one test client. Multi-client fan-out testing is out of scope for this iteration.
- **Branch protection**: The repository will have a branch protection rule requiring the new CI status check to pass before merging. Configuring this rule is outside the scope of this spec but is a prerequisite for SC-002 to hold.
- **Flow-to-file mapping**: A maintainable mapping exists that associates each email flow with its set of source files. When new email flows are added to the service, this mapping must be updated to include the new flow — this is a manual step, not automatic discovery.
