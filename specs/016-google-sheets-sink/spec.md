# Feature Specification: Google Sheets Sink for Form Notifications

**Feature Branch**: `016-google-sheets-sink`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Can you help me create a spec that makes the form notification more configurable? As of now, all the function does is: validate the payload, fetch the client config, send the email, log the result. This is a great start. But let's say the client wanted to store these form invocations on their end in some kind of internal data store. For instance, let's say a client had a Google Sheet that they wanted each form invocation to add a line to. For now, only worry about Google Sheets. This also needs to be entirely configurable and optional from the client side."

## Overview

This feature introduces per-client Google service account credentials as the single credential for all Google integrations. These credentials serve two purposes: (1) appending form submission data to a client-specified Google Sheet as a configurable, optional step in the form notification workflow, and (2) replacing the existing global GA4 service account environment variable so that analytics reports use each client's own Google credentials instead of a shared one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calling Application Routes a Submission to a Google Sheet (Priority: P1)

A client operates two separate websites, each with its own contact form. They want each form's submissions to land in a different Google Sheet. When triggering the notification service, each website includes a Google Sheets destination in its event payload specifying which sheet to write to. The service appends a row to that sheet on every invocation, in addition to sending the email.

**Why this priority**: This is the core deliverable. It establishes the per-invocation model that makes multi-form, multi-sheet routing possible for a single client.

**Independent Test**: Send two separate form notification events for the same client, each specifying a different spreadsheet ID in the payload, and verify that each event appends a row to its respective sheet.

**Acceptance Scenarios**:

1. **Given** a form notification event includes a valid Google Sheets destination (spreadsheet ID, optional tab name) and the client has valid credentials registered, **When** the event is processed, **Then** a new row is appended to the specified sheet containing the form data and submission timestamp.
2. **Given** a form notification event includes no Google Sheets destination in its payload, **When** the event is processed, **Then** the workflow completes normally (email sent, result logged) with no attempt to write to any sheet.
3. **Given** two form notification events for the same client specify different spreadsheet IDs, **When** each event is processed, **Then** each appends a row to its own designated sheet independently.

---

### User Story 2 - Sheets Write Failure Does Not Break Email Delivery (Priority: P2)

A calling application specifies a Google Sheet destination that is temporarily inaccessible (quota exceeded, sheet deleted, credentials expired). The notification service must still deliver the email and log the result — the Google Sheets write is a best-effort side effect, not a blocker.

**Why this priority**: Reliability of the primary notification (email) must not be compromised by an optional integration. Email delivery is the core contract; the sheet write is supplemental.

**Independent Test**: Send a form notification event specifying a non-existent spreadsheet ID in the payload, and verify the email is delivered and the result is logged — even though the sheet write failed.

**Acceptance Scenarios**:

1. **Given** a form notification event specifies a Google Sheets destination but the client's credentials are invalid, **When** the event is processed, **Then** the email is sent successfully, the result is logged, and the Sheets failure is recorded in the notification log without surfacing as a top-level workflow error.
2. **Given** a form notification event specifies a Google Sheets destination and the sheet API is temporarily unavailable, **When** the event is processed, **Then** the workflow completes (email sent, logged) and the Sheets step records a failure reason in the log.

---

### User Story 3 - Calling Application Controls Which Fields Map to Which Columns (Priority: P3)

A calling application wants precise control over how the sheet row is structured: which form fields appear, in what column order, and whether a submission timestamp is included. The application includes a column mapping in the event payload alongside the sheet destination.

**Why this priority**: Without column mapping, sheet rows contain raw fields in arbitrary order, which may not align with the client's existing sheet headers. Per-invocation column mapping makes the integration usable for forms with different field sets routing to sheets with different structures.

**Independent Test**: Send a form notification event that includes a column mapping (e.g., `["_timestamp", "name", "email", "message"]`) and verify the appended sheet row matches that exact column order.

**Acceptance Scenarios**:

1. **Given** a form notification event includes a column mapping in its payload, **When** the event is processed, **Then** the appended row contains only the mapped fields in the declared order, with unmapped fields omitted.
2. **Given** a form notification event includes a Google Sheets destination but no column mapping, **When** the event is processed, **Then** the appended row contains the submission timestamp in the first column followed by all submitted form fields in received order.
3. **Given** a form notification event's column mapping references a field name not present in the submission, **When** the event is processed, **Then** that column is written as an empty cell rather than causing a failure.

---

### User Story 4 - Analytics Reports Use Per-Client Google Credentials (Priority: P2)

The weekly analytics report currently authenticates with Google Analytics using a single global service account shared across all clients. Once clients register their own Google service account credentials, the analytics report for each client must use that client's credentials instead — eliminating the global service account entirely.

**Why this priority**: This aligns the analytics report with the same credential model as the Sheets integration, removes a global secret from server configuration, and gives each client full ownership of their own Google integrations. Ranked P2 because it is a migration of existing behavior, not new functionality.

**Independent Test**: Remove the global GA4 environment variable, configure a client with their own service account credentials that have access to their GA4 property, trigger an analytics report for that client, and verify the report is generated successfully using the client's credentials.

**Acceptance Scenarios**:

1. **Given** a client has valid Google service account credentials registered and those credentials have access to their GA4 property, **When** a weekly analytics report is generated for that client, **Then** the report fetches live data using the client's credentials — not a global service account.
2. **Given** a client has no Google service account credentials registered, **When** a weekly analytics report is generated for that client, **Then** the report falls back to mock data (same behavior as today when credentials are absent).
3. **Given** the global GA4 service account environment variable is removed from server configuration, **When** the system starts and analytics reports run, **Then** all existing functionality continues to work for clients with credentials registered, with no errors from the missing global variable.

---

### Edge Cases

- What happens when the specified sheet tab name does not exist in the spreadsheet? The write fails gracefully; the error is logged and email delivery proceeds.
- What happens when the submitted form has no fields (empty payload)? The row is appended with only the timestamp (or is empty if timestamp is excluded from the mapping); this is not treated as an error.
- What happens when the Google Sheets API returns a rate-limit error? The write step fails, logs the reason, and does not retry within the same invocation (the email is still delivered).
- What happens when the spreadsheet ID in the event payload is malformed or references a non-existent document? The write fails with a descriptive error recorded in the log; the rest of the workflow is unaffected.
- What happens when a calling application includes a Google Sheets destination but the client has no credentials registered? The Sheets step is skipped and a warning is logged; email delivery is unaffected.
- What happens when two events for the same client target the same sheet concurrently? Rows are appended independently; ordering between concurrent events is not guaranteed.
- What happens when a client's service account credentials have Sheets access but not GA4 access? The analytics report falls back to mock data; the Sheets integration continues to function.

## Requirements *(mandatory)*

### Functional Requirements

**Google Sheets Sink**

- **FR-001**: The system MUST support an optional Google Sheets destination passed as part of each form notification event payload — not stored in client-level settings.
- **FR-002**: When an event payload includes a Google Sheets destination and the client has valid credentials registered, the system MUST append a new row to the designated sheet before completing the workflow.
- **FR-003**: When an event payload includes no Google Sheets destination, the system MUST process the submission identically to current behavior — no sheet interaction of any kind.
- **FR-004**: Different events for the same client MAY specify different spreadsheet IDs and sheet tabs, enabling a single client to route multiple forms to multiple sheets independently.
- **FR-005**: The system MUST treat the Google Sheets write as a non-blocking step: a failure to write MUST NOT prevent the email from being sent or the result from being logged.
- **FR-006**: The system MUST record the outcome of the Google Sheets write attempt (success or failure with reason) as part of the notification log entry for each submission.
- **FR-007**: The Google Sheets destination in the event payload MUST include the target spreadsheet ID and MAY include a sheet tab name (defaulting to the first sheet if omitted).
- **FR-008**: The event payload MAY include an ordered column mapping — a list of field identifiers describing which submitted fields map to which columns and in what order.
- **FR-009**: When no column mapping is provided in the payload, the system MUST default to writing the submission timestamp in the first column followed by all submitted form fields in received order.
- **FR-010**: When a column mapping references a field absent from the submission, the system MUST write an empty value for that column rather than failing.
- **FR-011**: The system MUST validate that a Google Sheets destination in the payload is structurally complete before attempting a write; if incomplete, the step MUST be skipped with a warning logged.

**Per-Client Google Credentials**

- **FR-012**: The database schema MUST be extended with two new nullable columns on the `clients` table: one for the service account email address and one for the service account JSON key. These MUST be separate dedicated columns, not embedded in the existing `settings` JSONB field.
- **FR-013**: The service account email column MUST store the email address as plain text so it can be read and referenced without parsing JSON (e.g., for display during onboarding or for troubleshooting sheet access).
- **FR-014**: The system MUST support storing a Google service account credential per client at the client level, available to all Google integrations for that client.
- **FR-015**: Authentication credentials required to write to Google Sheets MUST be stored at the client level (registered once per client), not passed in individual event payloads.
- **FR-016**: The weekly analytics report MUST use the client's registered Google service account credentials to authenticate with Google Analytics, replacing the current global service account environment variable.
- **FR-017**: When a client has no Google service account credentials registered, the analytics report MUST continue to fall back to mock data — the same behavior as today.
- **FR-018**: The global GA4 service account environment variable MUST no longer be required for any part of the system once this feature is complete.

### Key Entities

- **Google Sheets Destination**: A per-invocation block included in the event payload specifying the spreadsheet ID, an optional sheet tab name, and an optional column mapping. Absent from the payload means no sheet write occurs.
- **Google Service Account Email**: The email address of the client's Google service account (e.g., `name@project-id.iam.gserviceaccount.com`). Stored as a dedicated plain-text column on the `clients` table. Used as the human-readable reference for granting sheet and GA4 access during onboarding and troubleshooting.
- **Google Service Account Key**: The full JSON key file contents for the client's Google service account. Stored as a dedicated column on the `clients` table. Used by the service to authenticate all Google API calls (Sheets writes, GA4 queries) on the client's behalf.
- **Column Mapping**: An ordered list of field identifiers included in the event payload that controls which submitted fields appear in which columns. Supports a reserved `_timestamp` identifier for the submission timestamp. Optional — defaults apply when omitted.
- **Sheet Write Result**: The outcome of a single Sheets append attempt — success (row appended) or failure (error reason). Captured in the notification log for the corresponding submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A calling application can target any Google Sheet by including a destination in its event payload — no code changes or deployments to the notification service are required to add or change a target sheet.
- **SC-002**: A single client can route submissions from multiple distinct forms to multiple distinct Google Sheets with no shared configuration between those forms.
- **SC-003**: 100% of form submissions are still delivered via email regardless of Google Sheets availability — zero regressions in email delivery rate.
- **SC-004**: All Google Sheets write outcomes (success and failure) are observable in the notification log, giving clients and operators full auditability of the integration.
- **SC-005**: Invocations that include no Google Sheets destination experience zero change in behavior or performance compared to the current workflow.
- **SC-006**: Weekly analytics reports continue to deliver accurate data for all clients that have registered Google service account credentials, with no dependency on any global environment variable.
- **SC-007**: A client with a single registered service account can use it for both Google Sheets logging and Google Analytics reporting without registering separate credentials for each.

## Client Onboarding

When onboarding a new client who will use Google Sheets logging or GA4 analytics reporting, the following steps must be completed before the integrations will function. These steps require both GCP access and access to the notification service's client database record.

### Step 1 — Create a Google Service Account in GCP

1. Open the client's GCP project (or create one if they do not have an existing project).
2. Navigate to **IAM & Admin → Service Accounts** and create a new service account with a descriptive name (e.g., `sol-notification-service`).
3. No GCP IAM roles need to be assigned to the service account at the project level — access is granted per-resource (sheet, GA4 property) in subsequent steps.
4. Once created, open the service account and go to the **Keys** tab. Click **Add Key → Create new key → JSON**. Save the downloaded `.json` file securely.

### Step 2 — Record the Credentials in the Client's Database Record

Update the client's record with two values from the downloaded JSON key file:

- **`google_service_account_email`** — the `client_email` field from the JSON file (e.g., `sol-notification-service@my-project.iam.gserviceaccount.com`). This is stored as plain text for easy reference.
- **`google_service_account_key`** — the full contents of the downloaded JSON file, stored as a JSON string. This is the secret used to authenticate API calls.

### Step 3 — Grant Sheet Access (for Google Sheets logging)

For each Google Sheet the client wants the service to write to:

1. Open the sheet in Google Sheets.
2. Click **Share** and add the service account email (recorded above) with **Editor** access.
3. Repeat for every additional sheet the client's applications may target — access must be granted per sheet.

### Step 4 — Enable the Google Sheets API (for Google Sheets logging)

In the client's GCP project, navigate to **APIs & Services → Library**, search for **Google Sheets API**, and enable it. Without this step, all sheet write attempts will be rejected regardless of permissions.

### Step 5 — Grant GA4 Property Access (for analytics reporting)

1. Open the client's Google Analytics account and navigate to **Admin → Property → Property Access Management**.
2. Add the service account email with **Viewer** role (or higher if required).

Once Steps 1–2 are complete, the client's analytics reports will use their credentials. Steps 3–4 are only required when Google Sheets logging is also needed.

---

## Assumptions

- Each client is responsible for creating their own Google service account in GCP and generating a JSON key. The notification service stores that key server-side in the client's database record.
- To grant the service account access to a Google Sheet, the client (or operator) must share that specific sheet with the service account email at Editor permission level. This must be done for each sheet the client wants the service to write to.
- To grant the service account access to a GA4 property, the client (or operator) must add the service account email as a Viewer or higher in their Google Analytics property settings.
- The Google Sheets API must be enabled in the client's GCP project for Sheets writes to succeed.
- The Google Sheets API quota and rate limits are the client's responsibility to manage; the service will not implement retry logic within a single invocation.
- Column headers in the target sheet are the calling application's responsibility to set up in advance; the service only appends rows and does not create or modify sheet structure.
- The reserved column identifier `_timestamp` represents the UTC ISO-8601 timestamp of the form submission event, not the time the row was written.
- This feature requires a database schema migration (V003) adding two nullable columns to the `clients` table: `google_service_account_email` (plain text) and `google_service_account_key` (JSON string). The existing `clients.settings` JSONB column is not used for credentials.
- The global `GA4_SERVICE_ACCOUNT_JSON` environment variable will be deprecated and removed as part of this feature.
