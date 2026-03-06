# Feature Specification: Production Deployment to Vercel

**Feature Branch**: `009-vercel-prod-deploy`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "as you can see in my previous spec I set up production grade logging with Pino and Logtail. Now I want to deploy my inngest application to prod so I can begin testing e2e and eventually turn this application on."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Application Running in Production (Priority: P1)

As the service operator, I need the notification service deployed to a live production environment so I can trigger real workflows end-to-end and verify the system behaves correctly outside of local development.

**Why this priority**: Nothing else in this spec is meaningful until the application is reachable in production. This is the foundation everything else depends on.

**Independent Test**: Trigger a form-submission workflow from the production URL and confirm an email is delivered to the correct recipient. Confirm structured logs appear in the log management dashboard filtered by `env = 'production'`.

**Acceptance Scenarios**:

1. **Given** the application is deployed, **When** a valid form-submission event is sent, **Then** an email is delivered to the configured recipient within 60 seconds and a success log entry appears in the log dashboard.
2. **Given** the application is deployed, **When** the health check endpoint is requested, **Then** it responds with a success status, confirming the server is running.
3. **Given** the application is deployed, **When** a workflow fails, **Then** an error log entry appears in the log dashboard with the client ID, error message, and stack trace — and Inngest retries the function automatically.

---

### User Story 2 - Inngest Cloud Connected to Production (Priority: P2)

As the service operator, I need the production deployment registered with the Inngest Cloud platform so that scheduled workflows (weekly analytics reports) trigger automatically on their configured schedule, and I can monitor runs, retries, and failures from the Inngest dashboard.

**Why this priority**: Manual event triggering proves the app works; Inngest Cloud connectivity proves the scheduled automation works. This is required before the service can be considered "on."

**Independent Test**: After connecting Inngest Cloud, trigger a manual `analytics/report.requested` event from the Inngest dashboard targeting a real client and confirm the full workflow completes — GA4 data fetched, email rendered, email sent.

**Acceptance Scenarios**:

1. **Given** Inngest Cloud is connected, **When** the weekly analytics cron fires, **Then** each active client receives an analytics report email within 10 minutes of the scheduled time.
2. **Given** a workflow step fails transiently, **When** Inngest retries it, **Then** the retry succeeds and the full workflow completes without operator intervention.
3. **Given** Inngest Cloud is connected, **When** a workflow is triggered manually from the dashboard, **Then** the run appears in the Inngest run history with step-level status.

---

### User Story 3 - Production Environment Variables Verified (Priority: P3)

As the service operator, I need all required secrets and configuration values set in the production environment so the application can connect to the database, send real emails, authenticate with GA4, and ship logs — without any silent fallbacks masking missing config.

**Why this priority**: The application has sensible local-dev fallbacks (mock email, mock GA4 data, stdout logging) that silently hide missing config. This story ensures production runs with real credentials, not masked defaults.

**Independent Test**: Trigger each integration independently — send a test email via the live email provider, confirm a GA4 report fetches real data, confirm logs appear in the log management dashboard — all from the production environment.

**Acceptance Scenarios**:

1. **Given** all environment variables are set, **When** an email workflow completes, **Then** the email is delivered via the live email provider (not logged to console) and the delivery ID appears in the email provider dashboard.
2. **Given** all environment variables are set, **When** an analytics report workflow runs, **Then** the report contains real GA4 data (not mock data) and the correct session counts for the period.
3. **Given** all environment variables are set, **When** any workflow runs, **Then** structured log entries appear in the log management dashboard within 10 seconds, filterable by `env = 'production'`.

---

### Edge Cases

- What happens if a required environment variable is missing in production? The application should fail loudly at startup (or at first use) rather than silently falling back to dev defaults.
- What happens if the database connection string is wrong? The health check should return a failure status so the deployment is immediately visible as broken.
- What happens if Inngest Cloud cannot reach the production serve endpoint? Inngest should surface a connectivity error in its dashboard; scheduled crons should not silently drop.
- What happens if the email provider rejects a send due to an unverified sender domain? The workflow step should fail with a clear error message and Inngest should retry according to the retry policy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be accessible via a stable public HTTPS URL in a production environment.
- **FR-002**: The application MUST respond to health check requests with a success status when all dependencies are reachable.
- **FR-003**: All scheduled workflows MUST trigger automatically at their configured times without manual intervention.
- **FR-004**: The application MUST deliver emails via the live email provider in production — mock and test modes MUST NOT be active.
- **FR-005**: The application MUST fetch real analytics data from GA4 in production — mock data MUST NOT appear in production reports.
- **FR-006**: The application MUST ship structured log entries to the log management platform in production, filterable by environment and client ID.
- **FR-007**: The application MUST connect to the production database and persist/retrieve client configuration correctly.
- **FR-008**: All required secrets (database credentials, email API key, GA4 service account, log transport token, Inngest signing key) MUST be set in the production environment before the application is considered live.
- **FR-009**: Failed workflow steps MUST be retried automatically up to the configured retry limit before being marked as failed.
- **FR-010**: The Inngest serve endpoint MUST be registered with Inngest Cloud so the platform can discover and invoke all workflow functions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A form-submission event triggered in production results in a delivered email within 60 seconds, verified in the email provider's sent log.
- **SC-002**: A weekly analytics report event triggered in production produces a report email containing real GA4 data (non-zero, non-mock session counts).
- **SC-003**: 100% of structured log entries from production workflows appear in the log management dashboard within 10 seconds of the event, filterable by `env = 'production'`.
- **SC-004**: The scheduled analytics cron fires within 5 minutes of its configured time on the first Tuesday after deployment.
- **SC-005**: Zero workflows are silently dropped — every triggered event either completes successfully or appears as a failed run in the Inngest dashboard.

## Assumptions

- The deployment platform (Vercel) is already connected to the repository and deployments are triggered automatically on merge to `main`.
- A Neon production database already exists (or will be provisioned) with the schema created by `npm run db:setup`.
- The email sender domain is already verified with the email provider.
- A GA4 service account with read access to each client's GA4 property is already available or will be created as part of this work.
- Inngest Cloud account already exists; connecting production is a matter of registering the serve endpoint URL.
- The log management platform source token from spec 008 will be set for the production environment.
- "Turning the application on" means real clients begin receiving scheduled emails — this is a post-deployment step gated on operator confirmation, not an automated action.
