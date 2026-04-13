# Feature Specification: Flexible Form Notification Fields

**Feature Branch**: `015-flexible-form-fields`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: Make the form notification function more configurable so that only the fields actually present on a given web form are required, and add new standard optional fields.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Submit a Form with Only an Email Address (Priority: P1)

A web form (e.g., a simple newsletter sign-up or a minimal contact widget) captures only the visitor's email address. The client's developer fires the `form/submitted` event with `clientId` and `submitterEmail`. The notification service routes and delivers the email notification successfully without rejecting the payload for missing name or message.

**Why this priority**: This is the motivating case from the feature request and represents the smallest valid payload. If this works, the core flexibility goal is achieved.

**Independent Test**: Trigger `form/submitted` with only `clientId` + `submitterEmail`. Verify a notification email is delivered and the log entry reflects the partial data.

**Acceptance Scenarios**:

1. **Given** a `form/submitted` event with only `clientId` and `submitterEmail`, **When** the notification workflow runs, **Then** a notification email is sent containing the submitter's email address and the notification log records the event as sent.
2. **Given** a `form/submitted` event with only `clientId` (no other fields), **When** the notification workflow runs, **Then** the workflow still completes and sends a notification email containing whatever data was provided.
3. **Given** a `form/submitted` event missing `clientId`, **When** the notification workflow runs, **Then** the workflow rejects the payload with a clear error indicating `clientId` is required.

---

### User Story 2 — Capture the Page the Form Was Submitted From (Priority: P2)

A client wants to know which page on their website generated a form submission (e.g., `/contact`, `/home`, `/services/web-design`). The developer includes `submittedFrom` in the event payload. The notification email displays this route so the client can immediately understand the context of the inquiry.

**Why this priority**: Knowing where a lead came from is a high-value signal for clients. `submittedFrom` is the first net-new field and drives adoption of the extended schema.

**Independent Test**: Trigger `form/submitted` with `clientId`, `submitterEmail`, and `submittedFrom: "/contact"`. Verify the notification email body includes the page route.

**Acceptance Scenarios**:

1. **Given** a payload that includes `submittedFrom: "/services/web-design"`, **When** the notification email is generated, **Then** the email body displays the submitted-from route in a clearly labelled section.
2. **Given** a payload that omits `submittedFrom`, **When** the notification email is generated, **Then** no "submitted from" section appears in the email (the field is silently omitted).

---

### User Story 3 — Submit a Full-Featured Contact Form (Priority: P3)

A client's primary contact form collects name, email, phone number, message, and the page the visitor was on. The developer sends all available standard fields. The notification email renders all collected data in a structured, readable format.

**Why this priority**: Ensures the extended field set works together and the email template handles a rich payload gracefully without layout issues.

**Independent Test**: Trigger `form/submitted` with all standard fields populated. Verify the notification email contains all sections rendered in a logical reading order.

**Acceptance Scenarios**:

1. **Given** a payload with `clientId`, `submitterName`, `submitterEmail`, `submitterPhone`, `submitterMessage`, `submittedFrom`, and `formName`, **When** the notification email is generated, **Then** all fields appear in the email body in a clear, consistent layout.
2. **Given** a payload with only a subset of standard fields, **When** the notification email is generated, **Then** only sections for the provided fields are shown — no blank or placeholder sections appear for omitted fields.

---

### User Story 4 — Pass Custom or Form-Specific Fields (Priority: P4)

A client uses a multi-step quote request form with unique fields (e.g., "Project Budget", "Timeline", "Service Type") that don't map to any standard field. The developer passes these as a `customFields` map. The notification email renders each custom field as a labelled key-value row, preserving the original field labels.

**Why this priority**: A `customFields` escape hatch makes the schema future-proof without requiring a new spec for every novel form type.

**Independent Test**: Trigger `form/submitted` with `customFields: { "Project Budget": "$5,000–$10,000", "Service Type": "Website Redesign" }`. Verify the notification email contains an "Additional Details" section with both rows.

**Acceptance Scenarios**:

1. **Given** a payload that includes a `customFields` map with two entries, **When** the notification email is generated, **Then** a clearly labelled "Additional Details" section appears with one row per custom field.
2. **Given** a payload with an empty `customFields` map (`{}`), **When** the notification email is generated, **Then** no "Additional Details" section is shown.
3. **Given** a payload with no `customFields` key at all, **When** the notification email is generated, **Then** the email renders identically to a payload with an empty `customFields` map.

---

### Edge Cases

- What happens when `submitterEmail` is present but malformed? The workflow proceeds without error — email format validation is the responsibility of the web form, not the notification service.
- What happens when `customFields` contains a large number of entries (e.g., 20+ keys)? The email renders all entries without truncation; no arbitrary limit is imposed.
- What happens when a `customFields` key or value contains HTML characters? Values must be rendered as plain text (HTML-escaped) to prevent injection in the notification email.
- What happens when all optional standard fields are omitted and no `customFields` are provided? The notification email still sends, containing at minimum the client identifier and a note that no additional data was captured.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `clientId` MUST remain the only required field in the `form/submitted` event payload; all other fields are optional.
- **FR-002**: The notification workflow MUST accept and process payloads containing any combination of these standard optional fields: `submitterName`, `submitterEmail`, `submitterPhone`, `submitterMessage`, `submittedFrom`, and `formName`.
- **FR-003**: The notification workflow MUST accept and render a `customFields` map — an arbitrary set of key-value string pairs — when present in the payload.
- **FR-004**: The notification email MUST only render sections for fields that are present and non-empty in the payload; absent fields MUST NOT produce blank, placeholder, or "N/A" rows.
- **FR-005**: The notification email MUST display `submittedFrom` (when present) as a clearly labelled page or route field so recipients immediately know which page generated the submission.
- **FR-006**: The notification email MUST display `submitterPhone` (when present) in a clearly labelled phone number field.
- **FR-007**: The notification email MUST display `formName` (when present) in a clearly labelled form name field, allowing clients to distinguish between multiple forms on their site.
- **FR-008**: Custom field values in `customFields` MUST be rendered as plain text; any HTML in key or value strings MUST be escaped to prevent injection.
- **FR-009**: The notification log entry MUST record the full set of submitted fields (standard and custom) in its metadata so the submission can be reconstructed from the log.
- **FR-010**: Existing payloads that include all currently required fields (`submitterName`, `submitterEmail`, `submitterMessage`) MUST continue to trigger successful notifications without any changes by the caller — full backward compatibility is required.

### Key Entities

- **Form Submission Event**: The `form/submitted` event payload. Contains `clientId` (required) plus any combination of standard optional fields and/or a `customFields` map. Represents a single visitor interaction with a web form.
- **Standard Field**: A named, typed slot in the payload with a well-known meaning (e.g., `submitterEmail`, `submittedFrom`). Standard fields have dedicated rendering in the notification email.
- **Custom Field**: An entry in the `customFields` map. Has a caller-defined label (key) and a plain-text value. Rendered generically in an "Additional Details" section of the notification email.
- **Notification Email**: The email delivered to the client when a form submission is received. Its content is dynamically composed from whichever fields are present in the payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing `form/submitted` event payloads that were valid before this change continue to trigger successful notifications without any modification by the caller.
- **SC-002**: A payload containing only `clientId` and one optional field successfully triggers and delivers a notification email in every tested scenario.
- **SC-003**: Notification emails contain zero blank, empty, or placeholder sections — every rendered section corresponds to a field that was present in the payload.
- **SC-004**: Payloads carrying a `customFields` map with up to 20 entries render all entries in the notification email without truncation or layout breakage.
- **SC-005**: All form submission data — standard and custom fields — is fully preserved in the notification log, enabling complete reconstruction of the original submission from the log alone.

## Assumptions

- `clientId` is always present; no use case exists where a form submission notification is triggered without knowing which client to notify.
- Email format validation is out of scope — the notification service trusts that the caller has validated field values before triggering the event.
- The existing `formId` field is deprecated in favor of `formName`. Callers should migrate to `formName` (a human-readable label such as "Contact Form"). `formId` will be accepted but ignored during a transition period; it will not appear in the notification email or log metadata.
- `customFields` values are always strings. Callers that need to pass numbers or booleans should convert them to strings before including them in the payload.
- The `submittedFrom` field carries a URL path (e.g., `/contact`) rather than a full URL. Both forms are acceptable; the email renders the value as provided without parsing or validation.
- There is no maximum field count enforced on `customFields` at the service level; callers are responsible for keeping payloads a reasonable size.
