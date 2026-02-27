# Feature Specification: Automated Testing & CI Pipeline

**Feature Branch**: `feature/004-testing-ci`
**Created**: 2026-02-27
**Status**: Draft
**Input**: User description: "in the last spec (003) we created a function for when a user submits a form. Can you please create comprehensive testing, as well as CI testing to ensure that moving forward there are no breaking changes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Verifies Workflow Correctness Locally (Priority: P1)

A developer working on the notification service runs a single command and receives
immediate feedback on whether the form notification workflow behaves correctly across
all paths: valid submissions, missing fields, unknown clients, inactive clients, and
each email mode (mock, test, live). No external services, running database, or Inngest
Dev Server are required — the test suite runs entirely in isolation using controlled
inputs and outputs.

**Why this priority**: Without a reliable local test suite, every code change requires
manual verification through the Inngest Dev UI. This is slow, error-prone, and
impossible to automate. A passing local suite is the foundation for everything else.

**Independent Test**: Run the test suite with a single command. Verify it completes
without errors, reports pass/fail for each scenario, and requires no live services
or environment secrets to execute.

**Acceptance Scenarios**:

1. **Given** a `form/submitted` event with all required fields and a known active client, **When** tests run, **Then** the send-email step is invoked with the correct recipient, subject, and body content
2. **Given** a `form/submitted` event with a missing required field (e.g., no `submitterEmail`), **When** tests run, **Then** the validate-payload step throws an error naming the missing field, and the send-email step is never reached
3. **Given** a `form/submitted` event with an unrecognised `clientId`, **When** tests run, **Then** the fetch-client-config step throws "Client not found" and no email is sent
4. **Given** a `form/submitted` event with an inactive client, **When** tests run, **Then** the fetch-client-config step throws "Client inactive" and no email is sent
5. **Given** the email mode is set to mock, **When** tests run, **Then** no real email delivery is attempted and the outcome is "logged"
6. **Given** the email mode is set to test, **When** tests run, **Then** the email is redirected to the configured test address with the original recipient preserved in the subject prefix
7. **Given** the email mode is set to live, **When** tests run, **Then** the send call is made to the real delivery provider with the exact recipient and subject

---

### User Story 2 - Pull Requests Are Automatically Validated Before Merge (Priority: P2)

A developer opens a pull request. Without any manual action, the CI system runs the
full test suite and type-checker against the proposed changes. If any test fails or
a type error is introduced, the pull request is blocked from merging. The developer
sees exactly which check failed and why directly in the pull request UI, without
leaving the browser or inspecting server logs.

**Why this priority**: The test suite only prevents regressions if it is enforced.
A passing local suite that nobody runs provides no protection. CI enforcement makes
the test suite the single source of truth for whether a change is safe to merge.

**Independent Test**: Open a pull request that intentionally breaks one of the
tested behaviours (e.g., remove a required field check). Verify the CI check fails,
the PR is blocked, and the failure message clearly identifies which test failed.

**Acceptance Scenarios**:

1. **Given** a pull request is opened or updated, **When** the CI pipeline runs, **Then** the full test suite and type-check complete within 3 minutes and their status is reported directly on the pull request
2. **Given** any test fails, **When** CI reports results, **Then** the pull request cannot be merged and the developer can identify the failing test and reason without accessing any external system
3. **Given** a TypeScript type error is introduced, **When** CI runs the type-checker, **Then** the check fails, merge is blocked, and the error location is reported
4. **Given** all tests pass and type-check succeeds, **When** CI reports results, **Then** the pull request is unblocked and ready for review or merge
5. **Given** CI is triggered on a push to the main branch (post-merge), **When** the suite runs, **Then** results are recorded so any breakage introduced at merge is immediately visible

---

### User Story 3 - Shared Infrastructure Behaviours Are Explicitly Verified (Priority: P3)

The shared modules that the form notification workflow depends on — client lookup,
email routing, and environment configuration — each have discrete, documented
behaviours. A developer can run the test suite and know that these contracts are
upheld: the client lookup throws the correct errors, email routing respects the
active mode, and configuration reads from the correct environment variables. Changes
to shared modules cannot silently break the workflow.

**Why this priority**: The form notification workflow is only as reliable as the
modules it calls. Testing the workflow steps alone does not guarantee the underlying
modules behave correctly when called with edge-case inputs. Explicit module-level
tests provide a safety net that is independent of the workflow's step execution.

**Independent Test**: Delete or change the error message thrown by the client lookup
module. Verify the corresponding test fails immediately, identifying the module and
the broken contract — without running a full workflow test.

**Acceptance Scenarios**:

1. **Given** a client ID that exists and is active, **When** the client lookup is called, **Then** it returns the correct client record
2. **Given** a client ID that does not exist, **When** the client lookup is called, **Then** it throws an error containing "Client not found" and the client ID
3. **Given** a client ID for an inactive client, **When** the client lookup is called, **Then** it throws an error containing "Client inactive" and the client ID
4. **Given** the email mode is mock, **When** `sendEmail` is called, **Then** it returns outcome "logged" without making any outbound delivery call
5. **Given** the email mode is test, **When** `sendEmail` is called, **Then** it delivers to the test address, not the original recipient, and prefixes the subject with the original recipient's address
6. **Given** required environment variables are absent at startup, **When** the config module loads, **Then** it throws a descriptive error identifying the missing variable — the application does not start in a misconfigured state

---

### Edge Cases

- What happens when the test suite is run with no environment variables configured? (Expected: tests that depend on config must supply their own controlled values — no test should fail simply because `.env.local` is absent from the developer's machine)
- What happens when a test is added for a new workflow but the CI pipeline is not updated? (Expected: CI automatically discovers and runs all test files matching the project's test file pattern — no manual pipeline update required for new test files)
- What happens when a flaky test fails intermittently in CI? (Expected: tests must be deterministic by design since all external dependencies are replaced with controlled fakes — timing and network variability are not a factor)
- What happens when CI is triggered but dependencies haven't changed? (Expected: CI installs dependencies on every run to guarantee a clean, reproducible environment)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST cover the `sendFormNotification` workflow: all four named steps (validate-payload, fetch-client-config, send-email, log-result), with at least one passing scenario and one failing scenario for each step
- **FR-002**: The test suite MUST cover the client lookup module: active client found (success), client not found (error message and client ID in thrown error), and inactive client (error message and client ID in thrown error)
- **FR-003**: The test suite MUST cover the email abstraction module: mock mode (no delivery, outcome "logged"), test mode (redirect to test address, subject prefix with original recipient), and live mode (delivery called with correct recipient and subject)
- **FR-004**: The test suite MUST cover the configuration module: correct values derived from environment for development, preview, and production contexts; startup throws with a descriptive error when a required variable is absent
- **FR-005**: All tests MUST run without requiring a live database connection, real email delivery credentials, or a running Inngest server — all external dependencies MUST be replaced with controlled fakes during test execution
- **FR-006**: The test suite MUST be executable with a single command (`npm test` or equivalent) from the project root
- **FR-007**: The CI pipeline MUST trigger automatically on every pull request opened or updated against the main branch
- **FR-008**: The CI pipeline MUST trigger automatically on every push to the main branch
- **FR-009**: The CI pipeline MUST run the full test suite and report results as a named check on the pull request
- **FR-010**: The CI pipeline MUST run the type-checker and report results as a named check on the pull request
- **FR-011**: CI check results MUST be visible directly on the pull request without accessing any external dashboard
- **FR-012**: The full test suite MUST complete within 60 seconds of execution start (excluding dependency installation)
- **FR-013**: Test output MUST clearly identify which test failed and include the expected vs actual values — a developer must not need to add logging to understand a failure

### Key Entities

- **Test Suite**: The collection of automated tests verifying the correctness of the form notification workflow and the shared modules it depends on. Runs locally and in CI.
- **CI Pipeline**: The automated workflow triggered on pull requests and main branch pushes that executes the test suite and type-checker, reporting results and enforcing merge requirements.
- **Controlled Fake**: A test-time replacement for an external dependency (database, email provider, Inngest runtime) that returns predictable, configurable responses without performing real I/O.
- **Branch Protection Rule**: A repository-level configuration that requires named CI checks to pass before a pull request can be merged into the main branch.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run the complete test suite locally with a single command and receive pass/fail results within 60 seconds, with no external services or credentials required
- **SC-002**: All four named steps of the form notification workflow are covered by tests — each step has at least one scenario that verifies the happy path and at least one that verifies the failure path
- **SC-003**: A pull request that removes or breaks any tested behaviour is automatically blocked from merging — a developer cannot merge without fixing the test or explicitly overriding the branch protection rule
- **SC-004**: The CI pipeline completes and reports check status on a pull request within 3 minutes of the pull request being opened or updated
- **SC-005**: A developer can identify exactly which test failed and why directly from the pull request checks UI, without opening any external tool or reading server logs
- **SC-006**: All tests are deterministic — running the suite 10 times in succession produces the same pass/fail result every time

---

## Assumptions

- Tests use controlled fakes (not real external services) for the database, email provider, and Inngest runtime — this is the only approach that satisfies FR-005 and the 60-second completion requirement.
- The CI provider is GitHub Actions, since the repository is already hosted on GitHub and no additional CI accounts are needed.
- Branch protection rules (requiring CI checks to pass before merge) are configured at the GitHub repository level as a separate administrative step — this feature provides the pipeline definition only.
- The test runner chosen must support TypeScript natively in the project's existing Node.js 20 environment without a separate compilation step.
- Tests for the email preview utility (`email-preview.ts`) are out of scope — this module performs file I/O and browser launching that are environment-specific and provide low testing value.
- The `hello-world` stub Inngest function is out of scope for testing — it contains no business logic.
- Performance, load, and stress testing are out of scope — success criteria focus on correctness and determinism.
- Test coverage reporting and coverage thresholds are out of scope for this feature — coverage tooling can be added in a future polish pass.

---

## Dependencies & Scope

**Depends on**: 002-core-infrastructure (config, db, email, logger modules), 003-form-notification (the workflow under test)

**Required before**: Any new Inngest workflow functions are added — the test patterns established here serve as the template for testing future workflows

**Out of scope for this feature**:
- End-to-end tests against a live Inngest server or real database
- Load, stress, or performance testing
- Test coverage reporting or coverage thresholds
- Email preview utility (`email-preview.ts`) tests
- Testing of the `hello-world` stub function
- Snapshot testing of email HTML output
- Mutation testing
- Deployment pipeline (build, push to registry, deploy to environment)
