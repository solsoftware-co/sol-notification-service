# Feature Specification: Form Submission Notification

**Feature Branch**: `003-form-notification`
**Created**: 2026-02-27
**Status**: Draft
**Input**: User description: "Form submission notification workflow: when a form is submitted, trigger an Inngest workflow that looks up the client, and sends a notification email to the client letting them know a form submission was received"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client Receives Submission Notification (Priority: P1)

A client (business owner) has a contact form on their website. When a visitor submits that
form, the client receives an email notification within minutes letting them know someone
reached out. The email contains the visitor's name, email address, and message — everything
the client needs to follow up — without requiring them to log into any dashboard or portal.

**Why this priority**: This is the entire value of the feature. Without it, nothing else matters. The client must receive the notification reliably and promptly, with enough detail to respond to the enquiry.

**Independent Test**: Send a test `form/submitted` event through the Inngest Dev UI with a valid client ID and submitter details. Verify the client's notification email is delivered (or logged in mock mode) containing the submitter's name, email, message, and which form was submitted.

**Acceptance Scenarios**:

1. **Given** a valid active client and a complete form submission event, **When** the workflow runs, **Then** the client receives an email containing the submitter's name, email address, message, and form name within 2 minutes of the event being sent
2. **Given** the service is in development (mock mode), **When** a form submission event is triggered, **Then** the notification email is logged to the console and written to the local preview file — no real email is delivered
3. **Given** the service is in preview (test mode), **When** a form submission event is triggered, **Then** the notification email is redirected to the configured test address with a visible banner indicating the original intended recipient
4. **Given** the service is in production (live mode), **When** a form submission event is triggered, **Then** the notification email is delivered directly to the client's registered email address

---

### User Story 2 - Failed Notifications Are Visible and Diagnosable (Priority: P2)

A client ID in a submitted event does not match any known client, or the client has been
deactivated. Rather than silently failing or sending to the wrong recipient, the workflow
stops immediately and records a clear, labelled failure in the run history. A developer can
open the observability dashboard and see exactly why the notification was not sent — without
reading logs or stack traces.

**Why this priority**: Silent failures are operationally dangerous. A client who expects a notification but doesn't receive one — with no visible record of why — erodes trust in the service. Diagnosable failures are required before this workflow can be used in production.

**Independent Test**: Send a `form/submitted` event with an unknown `clientId`. Verify the run appears in the Inngest dashboard with "Failed" status and a clear error message identifying the unrecognised client ID.

**Acceptance Scenarios**:

1. **Given** the event payload contains a `clientId` that does not exist, **When** the workflow runs, **Then** it fails with a "Client not found" error visible in the run history, and no email is sent
2. **Given** the event payload contains a `clientId` for an inactive client, **When** the workflow runs, **Then** it fails with a "Client inactive" error visible in the run history, and no email is sent
3. **Given** the email service is temporarily unavailable, **When** the workflow attempts to send the notification, **Then** the step is retried automatically at least 3 times before the run is marked as failed

---

### User Story 3 - Workflow is Triggerable from Any External Source (Priority: P3)

A developer integrating the notification service with a website, CMS, or third-party form
tool needs to know exactly what event to send and what data to include. The event contract
is simple enough that any HTTP-capable system can trigger it. The developer does not need
to understand the service internals — only the event name and payload structure.

**Why this priority**: The workflow has no value unless something can trigger it. While the Inngest Dev UI is sufficient for testing, a clear and stable event contract is required before any real integration can be built.

**Independent Test**: Using only the event name and payload documented in this spec, send a triggering event from a tool outside the notification service (e.g., a curl command or Postman request) and verify the workflow runs to completion.

**Acceptance Scenarios**:

1. **Given** the documented event name and payload structure, **When** an external system sends a conforming event, **Then** the notification workflow starts and completes successfully without any service-side configuration changes
2. **Given** the event payload is missing a required field (e.g., `clientId` is absent), **When** the workflow runs, **Then** it fails immediately with a clear error identifying the missing field — no partial processing occurs

---

### Edge Cases

- What happens when the submitter's email address is malformed? (Expected: the notification still delivers to the client — the submitter email is informational content in the email body, not a send target; no validation required on this field)
- What happens when the submitter's message is empty? (Expected: the notification is sent with the available fields; an empty message is valid)
- What happens when the same event is delivered more than once? (Expected: platform-level idempotency prevents duplicate runs for the same event ID)
- What happens when the client's registered email address is invalid? (Expected: the email send step fails and Inngest retries automatically; after exhausting retries the run is marked failed with the delivery error visible)
- What happens when `formId` is not provided in the event payload? (Expected: the email is sent with "Unknown form" as the form label — the notification still delivers)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST trigger the notification workflow when it receives a `form/submitted` event containing a valid payload
- **FR-002**: The event payload MUST support the following fields: `clientId` (required), `submitterName` (required), `submitterEmail` (required), `submitterMessage` (required), `formId` (optional)
- **FR-003**: The workflow MUST validate that `clientId`, `submitterName`, `submitterEmail`, and `submitterMessage` are present before any processing occurs, and fail immediately with a descriptive error if any are missing
- **FR-004**: The workflow MUST look up the client's notification email address from the data store using `clientId` before attempting to send any email
- **FR-005**: The notification email MUST include: submitter's name, submitter's email address, submitter's message, form identifier (or "Unknown form" if absent), and the date and time the submission was received
- **FR-006**: The workflow MUST route all email delivery through the shared email abstraction, respecting the active email mode (mock, test, or live)
- **FR-007**: The workflow MUST fail with a descriptive error and send no email if the client is not found or is marked inactive
- **FR-008**: The workflow MUST be retried automatically at least 3 times on transient failures (email service unavailable, database connection error)
- **FR-009**: Every step in the workflow MUST have a descriptive, human-readable name visible in the observability dashboard
- **FR-010**: The workflow MUST log the client ID and environment at function start, and log the email delivery outcome (mode, recipient, result) at completion

### Key Entities

- **Form Submission Event**: The triggering data sent when a visitor submits a form. Contains the identity of the receiving client, the submitter's contact details (name, email), the submitter's message, and an optional form identifier to distinguish between multiple forms on the same client's site.
- **Form Notification Email**: The outbound email delivered to the client. Presents the submission details in a readable format so the client can respond directly from their inbox.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A form submission event sent to the service results in the client's notification email being delivered (or logged in mock mode) within 2 minutes of the event being received
- **SC-002**: The notification email contains all submitted form fields — no information from the event payload is omitted from the email body
- **SC-003**: A failed notification run (invalid client, missing field, delivery error) is visible in the observability dashboard within 1 minute of the failure, with a human-readable error message requiring no log inspection to diagnose
- **SC-004**: The workflow can be triggered and tested end-to-end from the Inngest Dev UI using only the documented event name and payload — no code changes or external systems required for testing
- **SC-005**: The workflow handles the mock → test → live environment transition through environment variable changes only — no source code modifications required

---

## Assumptions

- The notification email is sent to the client (business owner) only. A confirmation email to the form submitter is out of scope for this feature.
- The event payload has a fixed, known structure. Arbitrary or dynamic form fields beyond the defined payload are out of scope; they may be considered in a future enhancement.
- The `formId` field is a simple string label (e.g., `"contact"`, `"quote-request"`). No form registry or validation of this value is required.
- The email body is plain HTML constructed directly in the workflow. Pixel-perfect design and brand styling are deferred to the email template feature (issue #3).
- The submission timestamp is derived from when the event arrives at the service — no client-side timestamp is required in the payload.
- Duplicate event delivery is handled by the platform's built-in idempotency — no application-level deduplication is required.

---

## Dependencies & Scope

**Depends on**: 002-core-infrastructure — requires the shared config, client lookup, email abstraction, and logger

**Required before**: Any real-world form integrations on client websites

**Out of scope for this feature**:
- Confirmation email to the form submitter
- Storing form submissions in the database
- Dynamic or arbitrary form fields beyond the defined payload
- Webhook endpoint for receiving form data (the event is sent directly to the workflow platform)
- Email template styling and branding (deferred to issue #3)
- Rate limiting or deduplication per client
