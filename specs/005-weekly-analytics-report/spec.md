# Feature Specification: Weekly Analytics Report

**Feature Branch**: `005-weekly-analytics-report`
**Created**: 2026-02-27
**Status**: Draft
**Input**: User description: "Weekly analytics report: a scheduled Inngest cron workflow that fetches GA4 data per client and emails a weekly analytics report to each active client"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client Receives Weekly Traffic Summary (Priority: P1)

A client (business owner) wakes up every Monday morning to find a clear, actionable
summary of the past week's website performance in their inbox — without logging into
any analytics platform. The email shows how many people visited their site, which
pages were most popular, and where visitors came from. They can glance at it over
coffee and know at a high level whether their site is growing or declining.

**Why this priority**: This is the primary value of the feature. Everything else —
fan-out isolation, environment safety, error visibility — exists to support reliable
weekly delivery to every active client. Without this, no other story matters.

**Independent Test**: Manually trigger the scheduler event in the Inngest Dev UI
with a valid client who has a GA4 property configured. Verify the client's analytics
email is delivered (or logged in mock mode) containing the previous 7 days of traffic
data: total sessions, active users, pageviews, and top pages.

**Acceptance Scenarios**:

1. **Given** an active client with a configured GA4 property, **When** the weekly cron fires, **Then** the client receives an email containing sessions, active users, pageviews, and the top 5 most-visited pages for the previous 7 days
2. **Given** the service is in development (mock mode), **When** the weekly cron fires, **Then** the analytics email is logged to the console and written to the local preview file — no real email is delivered
3. **Given** the service is in preview (test mode), **When** the weekly cron fires, **Then** the analytics email is redirected to the configured test address with a visible banner indicating the original intended recipient
4. **Given** the service is in production (live mode), **When** the weekly cron fires, **Then** the analytics email is delivered directly to each client's registered email address

---

### User Story 2 - One Client's Failure Does Not Block Others (Priority: P2)

The service has five active clients. One client has an invalid or expired GA4
property ID. That client's report fails — but the other four clients still receive
their reports on time. A developer can open the observability dashboard and see that
four runs succeeded and one failed, with a clear error message identifying the
problematic client and the reason for the failure.

**Why this priority**: Fan-out isolation is a constitutional requirement for all
multi-tenant scheduled workflows. A shared failure path would make the weekly report
unreliable at scale, eroding trust across the entire client base when one client's
configuration is misconfigured.

**Independent Test**: Seed two clients — one with a valid GA4 property and one with
an invalid or missing property. Trigger the scheduler. Verify that exactly one run
succeeds (email delivered) and one run fails with a clear error, with no interaction
between the two.

**Acceptance Scenarios**:

1. **Given** multiple active clients, **When** the weekly cron fires, **Then** each client's report is generated and delivered in isolation — one client's failure does not prevent others from receiving their reports
2. **Given** a client has no GA4 property ID configured, **When** their report workflow runs, **Then** it fails immediately with a "GA4 property not configured" error visible in the run history, and no email is sent for that client
3. **Given** a client's GA4 property ID is invalid or access has been revoked, **When** the analytics data fetch fails, **Then** the step retries at least 3 times before the run is marked failed with the GA4 error visible in the dashboard
4. **Given** a client is inactive, **When** the weekly cron fires, **Then** that client is excluded from the fan-out entirely — no workflow run is created for them

---

### User Story 3 - Non-Production Runs Are Safe and Rate-Limited (Priority: P3)

A developer or product manager triggers the weekly report in a preview or staging
environment to verify the content and formatting before the next production run.
The system sends at most one test email — to the configured test address — and never
delivers to real client inboxes. The developer can see what the report would look
like without any risk of real clients receiving duplicate or test emails.

**Why this priority**: Scheduled multi-client workflows carry higher risk than
on-demand single-client workflows. A misconfigured environment variable in staging
could trigger real emails to every client. Explicit non-production safety is
required before this workflow can be deployed to any shared environment.

**Independent Test**: Set `EMAIL_MODE=test` and manually trigger the report in the
Inngest Dev UI. Verify that at most one email is sent total (to the test address),
that the email clearly indicates it is a test, and that no real client emails are
touched regardless of how many active clients exist in the database.

**Acceptance Scenarios**:

1. **Given** the service is not in production, **When** the weekly cron fires, **Then** the fan-out is limited to clients whose email address contains `test` — no real client emails are processed
2. **Given** a non-production environment, **When** the scheduled event fires, **Then** at most 1 report is generated per scheduled run, regardless of how many test clients exist
3. **Given** the service transitions from preview to production (environment variable change only), **When** the next weekly cron fires, **Then** all active clients receive their reports without any code changes

---

### Edge Cases

- What happens when a client has a GA4 property configured but their website received zero traffic in the reporting period? (Expected: the report is sent with zero values for all metrics — an empty report is valid and the client should know their site had no traffic)
- What happens when the GA4 API is temporarily unavailable? (Expected: the analytics data fetch step retries automatically at least 3 times; after exhausting retries the individual client's run is marked failed with the API error, and other clients' runs are unaffected)
- What happens when a new client is added between the time the fan-out list is fetched and when their individual run executes? (Expected: the fan-out list is snapshot at cron fire time — new clients will be included in the next scheduled run)
- What happens when the cron fires but there are no active clients? (Expected: the scheduler run completes successfully with zero fan-out events — a no-op with a logged warning)
- What happens when the same cron fires twice in quick succession (e.g., a deployment restart)? (Expected: platform-level idempotency prevents duplicate fan-out events for the same scheduled window)
- What happens when a client's registered email is invalid and delivery fails? (Expected: the send step fails and retries automatically; after exhausting retries the run is marked failed with the delivery error visible in the dashboard)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST trigger the analytics report workflow on a weekly cron schedule (every Monday at 9:00 AM UTC) for all active clients
- **FR-002**: The scheduler MUST retrieve the list of all active clients in a single step and fan out one `analytics/report.requested` event per client, so each client's report runs independently and in parallel
- **FR-003**: The per-client report workflow MUST validate that the client has a GA4 property ID configured before fetching any data, and fail immediately with a descriptive error if the property is absent
- **FR-004**: The per-client report workflow MUST fetch the following GA4 metrics for the previous 7 days: total sessions, total active users, total pageviews, and the top 5 pages by session count
- **FR-005**: The analytics report email MUST include: the reporting period (start and end dates), total sessions, total active users, total pageviews, top 5 pages with their session counts, and the client's website name or domain
- **FR-006**: The workflow MUST route all email delivery through the shared email abstraction, respecting the active email mode (mock, test, or live)
- **FR-007**: In non-production environments, the fan-out MUST be restricted to clients whose email address contains `test`, and a safety rate limit of at most 1 report per scheduled run MUST be applied
- **FR-008**: Each step in both the scheduler and per-client workflows MUST have a descriptive, human-readable name visible in the observability dashboard
- **FR-009**: One client's failure MUST NOT prevent other clients' reports from being generated and delivered — fan-out isolation is required
- **FR-010**: The workflow MUST log the client ID, GA4 property ID, and email delivery outcome (mode, recipient, result) at each relevant step
- **FR-011**: Every analytics data fetch and email send step MUST retry automatically at least 3 times on transient failure before the run is marked failed
- **FR-012**: The workflow MUST be manually triggerable from the Inngest Dev UI for testing without waiting for the scheduled cron window

### Key Entities

- **Analytics Report Scheduler**: The top-level cron-triggered workflow that fires weekly, retrieves all active clients, and fans out per-client report events. Produces one `analytics/report.requested` event per active client.
- **Per-Client Report Workflow**: Triggered by `analytics/report.requested`. Validates the client's GA4 configuration, fetches the previous week's metrics, builds the report email, and delivers it via the shared email abstraction.
- **Analytics Report Email**: The outbound email delivered to the client each week. Contains the reporting period, aggregated traffic metrics, and a ranked list of top pages — presented for a non-technical business owner audience.
- **Client Analytics Configuration**: Per-client settings, stored in the `clients` database table, identifying the GA4 property ID associated with the client's website. Absent configuration causes the per-client run to fail with a clear diagnostic error.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All active clients with a configured GA4 property receive their weekly analytics email within 15 minutes of the cron trigger firing
- **SC-002**: A client with a missing or invalid GA4 configuration fails with a human-readable error visible in the observability dashboard within 2 minutes of their workflow starting — without affecting any other client's report
- **SC-003**: The weekly cron can be triggered and tested end-to-end from the Inngest Dev UI without waiting for the Monday schedule, using only the documented event name and payload — no code changes required
- **SC-004**: The workflow handles the mock → test → live environment transition through environment variable changes only — no source code modifications required
- **SC-005**: A non-production trigger never delivers analytics reports to real client email addresses, regardless of how many active clients exist in the database
- **SC-006**: A developer can diagnose any failed client report run within 5 minutes using only the Inngest dashboard — no log inspection or code changes required

---

## Assumptions

- Each client's GA4 property ID is stored as a column (`ga4_property_id`) in the existing `clients` table. If this column does not yet exist, a schema migration is required as part of this feature.
- The reporting period is always the previous 7 calendar days relative to the cron fire time. A configurable reporting window is out of scope.
- The weekly cron fires every Monday at 9:00 AM UTC. The specific day and time are not client-configurable in this feature.
- The GA4 metrics included in the report (sessions, active users, pageviews, top 5 pages) represent the minimum viable data set. Additional metrics (bounce rate, new vs. returning users, conversion events) may be added in a future enhancement.
- The report email is plain HTML constructed directly in the workflow, consistent with the approach used in 003. Pixel-perfect design and brand styling are deferred to the email template feature.
- GA4 data is fetched using service-to-service API access with a shared credential (service account or API key). OAuth end-user consent and per-client credential management are out of scope.
- A client with zero traffic in the reporting period receives a report with zero values — not a skipped delivery.
- The `clients` table already has an `active` flag (used by 003). Inactive clients are excluded at fan-out time using the same query pattern.

---

## Dependencies & Scope

**Depends on**: 002-core-infrastructure (config, db, email, logger modules), 003-form-notification (establishes the workflow pattern this feature follows)

**Required before**: Any client-facing analytics or reporting features that build on aggregated traffic data

**Out of scope for this feature**:
- Per-client configurable reporting schedules or delivery times
- Analytics for channels beyond organic web traffic (e.g., email campaign stats, social media metrics)
- Historical report storage or a reporting archive/dashboard
- Custom date range or on-demand report generation triggered by clients
- GA4 authentication via end-user OAuth flow (service-to-service API access only)
- Email template styling and branding (deferred to email templates feature)
- Conversion event tracking or goal completion metrics
- Comparison to prior period (e.g., "up 12% vs. last week") — flat metrics only
