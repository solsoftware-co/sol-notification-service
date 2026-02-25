# Feature Specification: Core Shared Infrastructure

**Feature Branch**: `002-core-infrastructure`
**Created**: 2026-02-24
**Status**: Draft
**Input**: User description: "Core shared infrastructure: environment config, database client, email abstraction, shared types, logging utilities, and function template"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Environment-Aware Email Sending (Priority: P1)

A developer writes a workflow that sends a notification email. They call a single shared
send-email operation with the recipient, subject, and content. The service automatically
handles the delivery mode based on the current environment: in development, the email is
logged to the console and the rendered HTML opens automatically in the browser for
inspection (no real send); in preview, the email is redirected to a designated test address
with context showing the original recipient; in production, the email goes to the real
recipient. The developer writes zero environment-specific conditional logic inside the
workflow.

**Why this priority**: Every downstream workflow (form notification, weekly analytics, etc.)
depends on safe email sending. Without this, workflows either send real emails in development
or cannot be built at all. This is the single most critical safety and productivity requirement
for every future feature.

**Independent Test**: With the service running, set the email mode to mock and trigger an
email send. Verify the email appears as a console log entry, no outbound email is sent, and
the rendered HTML opens automatically in the browser at `.email-preview/last.html`. Switch
to test mode and verify the email is delivered to the test address (not the original
recipient) with a subject prefix indicating the original intended recipient. Switch to live
mode and verify the email reaches the real recipient.

**Acceptance Scenarios**:

1. **Given** the service is running in development (mock mode), **When** a workflow sends an email to `client@example.com`, **Then** no real email is sent, a log entry appears with the recipient, subject, and body length, and the rendered HTML is written to `.email-preview/last.html` and opened automatically in the browser
2. **Given** the service is running in preview (test mode), **When** a workflow sends an email to `client@example.com` with subject "Weekly Report", **Then** an email is delivered to the configured test address with subject `[TEST: client@example.com] Weekly Report` and a visible banner indicating the original recipient
3. **Given** the service is running in production (live mode), **When** a workflow sends an email to `client@example.com`, **Then** the email is delivered directly to `client@example.com` with the original subject and content unchanged
4. **Given** the service receives an unrecognized email mode value, **When** any workflow attempts to send an email, **Then** the workflow fails with a clear error identifying the misconfiguration

---

### User Story 2 - Single Source of Environment Configuration (Priority: P2)

A developer adds a new workflow and needs to know: what environment is the service running in?
What email mode is active? Are production credentials available? Rather than reading environment
variables ad-hoc throughout the codebase, they access a single configuration object that
provides all this information with sensible defaults already applied — development if no
environment is set, mock email mode in development, test mode in preview, live mode in
production (unless explicitly overridden).

**Why this priority**: Without a single configuration source, each developer or AI agent
reading environment variables independently will produce inconsistent behavior and scattered
conditionals. This is the prerequisite for US1 and for correct multi-environment behavior
in all future workflows.

**Independent Test**: Start the service without setting any environment variables. Verify
the configuration reports the environment as "development" and email mode as "mock". Then
set the environment to "preview" without setting email mode explicitly. Verify the
configuration reports email mode as "test". Then set the environment to "production". Verify
the configuration reports email mode as "live". Each test requires only environment variable
changes and a service restart — no code changes.

**Acceptance Scenarios**:

1. **Given** no `VERCEL_ENV` is set, **When** the service starts, **Then** the configuration reports environment as "development" and email mode defaults to "mock"
2. **Given** `VERCEL_ENV=preview` is set without an explicit email mode, **When** the service starts, **Then** the configuration reports email mode as "test"
3. **Given** `VERCEL_ENV=production` is set without an explicit email mode, **When** the service starts, **Then** the configuration reports email mode as "live"
4. **Given** `EMAIL_MODE=mock` is explicitly set with `VERCEL_ENV=production`, **When** the service starts, **Then** the explicit override takes precedence and email mode is "mock"

---

### User Story 3 - Client Record Lookup (Priority: P3)

A workflow receives a client ID in its event payload and needs that client's notification
email address, display name, and settings before it can proceed. The developer calls a shared
lookup operation with the client ID and receives a validated, typed client record in return.
If the client does not exist or is marked inactive, the operation returns a clear, descriptive
error that is captured in the run's log — the developer does not need to write their own
existence or activation checks.

**Why this priority**: Multi-tenant correctness (every workflow scoped to a client) is a
non-negotiable architectural requirement. This lookup is called at the start of every
workflow. It must exist before any real workflow can be implemented.

**Independent Test**: With test clients seeded in the data store, call the client lookup
with a known active client ID. Verify the correct record is returned. Then call with an
unknown ID and verify a clear "client not found" error. Then call with an inactive client ID
and verify a clear "client inactive" error.

**Acceptance Scenarios**:

1. **Given** an active client exists in the data store, **When** a workflow looks up that client by ID, **Then** the client's name, email, settings, and active status are returned
2. **Given** no client exists with the provided ID, **When** a workflow performs the lookup, **Then** the operation fails with a "client not found" error that includes the requested ID
3. **Given** a client exists but is marked inactive, **When** a workflow performs the lookup, **Then** the operation fails with a "client inactive" error
4. **Given** the data store is unreachable, **When** a workflow performs the lookup, **Then** the operation fails with a descriptive connection error (which Inngest will automatically retry)

---

### User Story 4 - Data Store Initialization (Priority: P4)

A developer cloning the project for the first time runs a single setup command that creates
all required tables in the database and then runs a seed command that populates it with at
least two test clients. After these two commands, the developer can immediately run a workflow
that fetches client configuration without any further database setup. All SQL is encapsulated
in the commands — the developer writes no manual queries.

**Why this priority**: Without initialized test data, US3 (client lookup) cannot be tested
end-to-end and no workflow can be exercised with realistic multi-tenant data. This is
required before the form notification and analytics workflows (003, 004) can be developed.

**Independent Test**: Start with an empty database. Run the setup command. Verify the clients
table and notification_logs table exist. Run the seed command. Verify at least two client
records are present, with distinct IDs, names, email addresses, and one having a GA4 property
ID set.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the setup command runs, **Then** the clients table and notification_logs table are created with no errors
2. **Given** a freshly set-up database, **When** the seed command runs, **Then** at least two test client records are inserted, each with a unique ID, name, email, and active status
3. **Given** the setup command is run against a database that already has the tables, **When** it runs again, **Then** it completes without error and does not destroy existing data

---

### User Story 5 - Canonical Workflow Template (Priority: P5)

A developer (or AI agent) needs to add a new notification workflow. Rather than guessing
the correct structure, they copy the canonical template file, rename it, and change only
the event trigger name and business logic. The template already demonstrates: how to retrieve
the environment, how to look up a client, how to name steps descriptively, how to send an
email through the shared abstraction, and how to log outcomes with client ID and environment
context. The copied workflow runs successfully on the first attempt without structural changes.

**Why this priority**: This template is what makes AI-assisted workflow creation viable (UC-5
from the PRD). It must exist alongside the other infrastructure components so that features
003 and 004 can be implemented consistently.

**Independent Test**: Copy the template to a new file, register it in the function registry,
send a matching test event in the Inngest Dev UI, and verify the run completes with "Completed"
status, all steps named correctly, and a mock email log entry visible in the terminal.

**Acceptance Scenarios**:

1. **Given** the template is copied and a matching event is sent, **When** the workflow runs, **Then** all steps execute in order and the run shows "Completed" status
2. **Given** the template is registered without modification, **When** a test event is sent, **Then** no TypeScript errors occur and no structural changes to the template are required
3. **Given** an AI agent is asked to create a new workflow, **When** it follows the template structure, **Then** the resulting function passes type-checking and runs correctly without additional guidance

---

### Edge Cases

- What happens when `DATABASE_URL` is not set and a workflow attempts a client lookup? (Expected: clear startup or runtime error identifying the missing configuration)
- What happens when `RESEND_API_KEY` is missing but `EMAIL_MODE=live`? (Expected: the email send step fails with a descriptive configuration error)
- What happens when a client's email address is empty or malformed? (Expected: the send-email operation rejects it before attempting delivery)
- What happens when the test address (`TEST_EMAIL`) is not configured in test mode? (Expected: a clear error at send time indicating the missing configuration)
- What happens when the data store connection drops mid-workflow? (Expected: the step fails and Inngest retries it automatically)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST expose all environment configuration through a single shared configuration object, readable by any workflow or library module
- **FR-002**: The configuration object MUST derive sensible defaults: environment defaults to "development", email mode defaults based on environment (mock → test → live for dev → preview → production)
- **FR-003**: Explicit environment variable overrides MUST take precedence over derived defaults
- **FR-004**: The service MUST support three email delivery modes — mock, test, and live — selectable via environment configuration
- **FR-005**: In mock mode, the service MUST log the email details to the console, MUST write the rendered HTML to `.email-preview/last.html` and open it in the default browser, and MUST NOT send any outbound email
- **FR-020**: The mock mode email preview file (`.email-preview/`) MUST be excluded from version control
- **FR-006**: In test mode, the service MUST redirect all emails to a configured test address and MUST include the original recipient in the subject line prefix `[TEST: <original>]`
- **FR-007**: In live mode, the service MUST deliver email to the original recipient with the subject and content unchanged
- **FR-008**: Every email send attempt (in any mode) MUST produce a log entry containing: delivery mode, original recipient, subject, and outcome
- **FR-009**: The service MUST reject email send attempts where the recipient address is empty or does not contain an "@" character
- **FR-010**: The service MUST provide a client lookup operation that accepts a client ID and returns the client's name, email, GA4 property identifier, active status, and settings
- **FR-011**: The client lookup operation MUST return a descriptive error if the client ID does not exist in the data store
- **FR-012**: The client lookup operation MUST return a descriptive error if the client exists but is marked inactive
- **FR-013**: All data store connection details MUST be read exclusively from environment configuration — never hardcoded
- **FR-014**: The service MUST provide a setup command that creates all required tables in the data store
- **FR-015**: The service MUST provide a seed command that populates the data store with at least two test client records
- **FR-016**: The setup command MUST be idempotent — running it against an already-configured data store MUST NOT destroy existing data
- **FR-017**: The service MUST provide a canonical workflow template demonstrating: event trigger, client config lookup step, email send step, result logging, and step naming conventions
- **FR-018**: Every log entry produced by the service MUST include the current environment name
- **FR-019**: Every log entry produced inside a workflow MUST include the client ID when one is available

### Key Entities

- **Client**: A business customer of the notification service. Has a unique identifier, display name, primary notification email address, GA4 analytics property identifier, active/inactive status, and a flexible key-value settings store for future customization. One client may receive many notifications over time.
- **Notification Log**: A record of a single notification delivery attempt. Captures which client was notified, which workflow triggered the notification, the event that initiated it, the delivery outcome, and a timestamp. Optional for the PoC but the table must exist.
- **Environment Configuration**: The complete set of runtime settings (current environment name, email delivery mode, test recipient address, data store connection, external service credentials) derived from environment variables at service startup. Treated as immutable for the lifetime of a process.
- **Email Delivery Request**: A named set of attributes describing a single outbound notification: intended recipient, subject line, HTML body content, and optional sender address override.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can add a new workflow by copying the template and changing only the event name and business logic — the resulting function passes validation and runs correctly without any structural changes to the template
- **SC-002**: Running the service locally without any email-related configuration set results in zero outbound emails, regardless of how many workflows complete successfully
- **SC-007**: A developer working in mock mode can see the full rendered HTML of any email their workflow would send — it opens automatically in the browser — without any email being delivered
- **SC-003**: Switching between development, preview, and production behavior requires only environment variable changes — no source code modifications in any workflow or library
- **SC-004**: A developer can go from an empty data store to a seeded, multi-tenant-ready service in two commands, with no manual SQL required
- **SC-005**: Every email send attempt produces a visible log entry within the same run, showing mode, original recipient, and outcome — locatable in the observability dashboard in under 1 minute
- **SC-006**: A misconfigured environment (missing required credentials for the active mode) produces a clear, human-readable error message identifying exactly which configuration is missing — no stack traces required to diagnose

---

## Assumptions

- The three supported environments are exactly: development, preview, and production. No other environment names are required for the PoC.
- The test address (`TEST_EMAIL`) is a single fixed address configured per environment. Routing to multiple test addresses is out of scope.
- Client records are managed directly in the data store (no admin UI). Adding or removing clients for the PoC is done via the seed script or direct database access.
- The notification_logs table is created but not actively written to in this feature — logging to Inngest's own run history is sufficient for the PoC. Actual writes to notification_logs are deferred to a future feature.
- The canonical template demonstrates a single-step email send. Multi-step workflows with branching or fan-out are demonstrated in the actual workflow features (003, 004), not the template.
- GA4 credentials and Anthropic API key are not required for this feature. Those integrations are added in features 003 and 004.

---

## Dependencies & Scope

**Depends on**: 001-inngest-dev-setup (local development environment must be running)

**Required before**: 003-form-notification, 004-weekly-analytics — neither workflow can be built correctly without the config, email, and client lookup capabilities established here

**Out of scope for this feature**:
- Actual notification workflows (form submission, analytics reports)
- GA4 integration
- Anthropic/AI integration
- Vercel deployment configuration
- Client self-service or admin interface
- Writing to the notification_logs table from within workflows
