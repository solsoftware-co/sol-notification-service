# Feature Specification: Notification Send Logging

**Feature Branch**: `012-notification-logging`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Persist email send records to notification_logs table so every email is auditable and reproducible — store recipient, subject, resend_id, outcome, error_message, and a metadata JSONB payload containing all workflow inputs needed to re-render the email locally"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Audit Sent Emails (Priority: P1)

A developer or operator wants to answer "did the weekly analytics email go out to client X last Tuesday?" without digging through application logs. They query the notification log and immediately see the record — who received it, when, whether it succeeded, and the Resend ID to look up delivery status on the Resend dashboard.

**Why this priority**: This is the core value of the feature. Without it, there is no visibility into what has actually been sent in production.

**Independent Test**: Trigger a weekly analytics email send for a test client. Query the notification_logs table and confirm a row exists with the correct recipient, subject, outcome, and a valid Resend ID.

**Acceptance Scenarios**:

1. **Given** a weekly analytics email is sent successfully, **When** the notification_logs table is queried, **Then** a record exists with recipient email, subject line, `outcome = 'sent'`, a non-null Resend ID, and a timestamp.
2. **Given** an email send fails (e.g. delivery provider API error), **When** the notification_logs table is queried, **Then** a record exists with `outcome = 'failed'` and a non-null `error_message` describing the failure.
3. **Given** a client is looked up by ID, **When** filtering notification_logs by client_id and workflow, **Then** only records for that client and workflow are returned.

---

### User Story 2 - Reproduce a Sent Email Locally (Priority: P2)

A developer wants to inspect exactly what was sent to a client — perhaps to debug a rendering issue or verify chart data. They pull the log record for that send, copy the `metadata` payload, pass it as inputs to the local email preview tool, and see the same email that was sent in production.

**Why this priority**: Reproducibility turns the audit log into a debugging tool. Without the metadata payload, the log is useful for confirming delivery but not for investigating content issues.

**Independent Test**: Trigger a weekly analytics email send. Retrieve the `metadata` from the resulting log row. Use those values as inputs to the local email preview command and confirm the email renders without errors.

**Acceptance Scenarios**:

1. **Given** a logged analytics report send, **When** the `metadata` field is retrieved, **Then** it contains at minimum: `client_id`, `ga4_property_id`, `period_preset`, `date_range_start`, and `date_range_end`.
2. **Given** a logged form notification send, **When** the `metadata` field is retrieved, **Then** it contains the original form submission payload.
3. **Given** a metadata payload from any log record, **When** used as inputs to the local preview tool, **Then** the email renders successfully without requiring any additional lookup.

---

### User Story 3 - Distinguish Skipped Sends (Priority: P3)

An operator notices a client did not receive an analytics email. They query the logs and find a record with `outcome = 'skipped'` and an explanation — for example, "client has no GA4 property configured." This distinguishes a deliberate skip from a missing log entry (which would indicate the workflow never ran).

**Why this priority**: Distinguishing "email was intentionally skipped" from "nothing happened" is important for operational confidence, but lower priority than capturing successful and failed sends.

**Independent Test**: Trigger a weekly analytics workflow for a client with no GA4 property configured. Query notification_logs and confirm a `skipped` record exists with a human-readable reason.

**Acceptance Scenarios**:

1. **Given** a client with no GA4 property, **When** the analytics scheduler runs, **Then** a log record with `outcome = 'skipped'` and a descriptive `error_message` is written.

---

### Edge Cases

- What happens if the log write fails after the email was already sent? The email was delivered but there is no audit record. The log write must not cause the workflow to retry the email send — it is a best-effort side-effect.
- What if the same workflow runs twice for the same client in the same period (e.g. manual re-trigger)? Both runs produce separate log records; deduplication is not a concern at the logging layer.
- What happens in development or preview? No log record is written. The email send step still runs normally; only the DB write is skipped.
- What if the same workflow runs twice for the same client in the same period (e.g. manual re-trigger)? Both runs produce separate log records; deduplication is not a concern at the logging layer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST write a record to `notification_logs` after every email send attempt in production (live email mode) across all workflows (analytics report, form notification). No log records are written in development or preview environments.
- **FR-002**: Each log record MUST include: `client_id`, `workflow` name, `event_name`, `recipient_email`, `subject`, `outcome`, and `created_at`.
- **FR-003**: Each log record MUST include a `resend_id` field containing the external delivery provider's ID on successful sends, and null otherwise.
- **FR-004**: Each log record MUST include an `error_message` field containing a human-readable description when `outcome` is `'failed'` or `'skipped'`, and null otherwise.
- **FR-005**: Each log record MUST include a `metadata` JSONB field containing all workflow input values required to reproduce the email locally without any additional data lookup.
- **FR-006**: The `metadata` field for analytics report sends MUST include at minimum: `ga4_property_id`, `period_preset`, `date_range_start`, and `date_range_end`.
- **FR-007**: The `metadata` field for form notification sends MUST include the complete original form submission payload.
- **FR-008**: A log write failure MUST NOT cause the workflow step that sent the email to be retried or marked failed.
- **FR-009**: The `outcome` field MUST be one of: `'sent'`, `'failed'`, or `'skipped'`.
- **FR-010**: The existing `notification_logs` table schema MUST be extended via a new versioned migration to add the required columns.

### Key Entities

- **NotificationLog**: Represents a single email send attempt. Belongs to a `client`. Fields: id, client_id, workflow, event_name, recipient_email, subject, resend_id, outcome, error_message, metadata (JSONB), created_at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every email send attempt (successful, failed, or skipped) across all workflows produces a queryable record in the notification log within the same workflow execution.
- **SC-002**: A developer can retrieve the `metadata` from any log record and use it as inputs to the local email preview tool to reproduce the email without any additional data lookup.
- **SC-003**: The addition of log writes does not cause any previously passing workflow tests to fail.
- **SC-004**: Querying notification_logs by `client_id` and `workflow` returns an accurate, complete history of all send attempts for that client.

## Assumptions

- The `notification_logs` table already exists in the production database via migration V001. The new migration adds columns only — no data loss or table recreation.
- `resend_id` is null for mock and test email modes; this is acceptable and expected.
- No retention policy or archiving strategy is in scope for this feature. Records accumulate indefinitely.
- No UI for browsing logs is in scope — direct SQL queries are the intended interface at current scale.
