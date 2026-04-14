# Feature Specification: Form Notification Payload Controls

**Feature Branch**: `018-form-notification-controls`  
**Created**: 2026-04-14  
**Status**: Draft

## Overview

Extend the `form/submitted` event payload with two optional controls that give calling applications finer-grained authority over what the form notification workflow does:

1. **Email send toggle** (`sendEmail`) — skip the email step entirely while still allowing other workflow actions (e.g. Google Sheets sync) to proceed.
2. **CTA button configuration** (`ctaButton`) — override the call-to-action button's label and action in the notification email. Supports two action types: open a URL in a new tab, or compose a reply email (the existing default).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Email Send Toggle (Priority: P1)

A calling application submits a form event where no email notification is needed — for example, a data-collection form that feeds a Google Sheet. The application sets `sendEmail: false` in the payload and the workflow skips the email step entirely, while still completing any other configured steps (Sheets sync, logging).

**Why this priority**: This is an immediately useful capability for clients who have forms where collecting data is the goal and email alerts would be noise. It is also independently simple to implement and test.

**Independent Test**: Fire a `form/submitted` event with `sendEmail: false`; confirm no email is sent or logged, the Sheets sync step still runs, and the notification log records outcome `"skipped"` (or no log entry, depending on mode).

**Acceptance Scenarios**:

1. **Given** a `form/submitted` event with `sendEmail: false`, **When** the workflow runs, **Then** no email is sent and the email step is skipped gracefully with a logged reason.
2. **Given** a `form/submitted` event with `sendEmail: true` (explicit), **When** the workflow runs, **Then** the email is sent normally — identical to omitting the field.
3. **Given** a `form/submitted` event with no `sendEmail` field (omitted), **When** the workflow runs, **Then** the email is sent normally — the field defaults to `true`.
4. **Given** a `form/submitted` event with `sendEmail: false` and a `sheetsDestination` configured, **When** the workflow runs, **Then** the Google Sheets sync step still executes normally.

---

### User Story 2 — Configurable CTA Button (Priority: P1)

A calling application wants the form notification email's call-to-action button to link to something more useful than a reply email — for example, a link to the submission in a CRM or a project management tool. The application provides a `ctaButton` object in the payload with a custom label and a URL action. The rendered email shows the custom button, and clicking it opens the URL in a new tab.

**Why this priority**: The existing mailto CTA is often the wrong action for modern form workflows. A configurable URL link is the most common desired alternative and delivers immediate value for clients using third-party tools to track submissions.

**Independent Test**: Fire a `form/submitted` event with `ctaButton: { text: "View in CRM", action: { type: "url", url: "https://crm.example.com/lead/123" } }`; confirm the rendered email contains a button labelled "View in CRM" that links to the provided URL (target: new tab).

**Acceptance Scenarios**:

1. **Given** `ctaButton: { text: "View in CRM", action: { type: "url", url: "https://crm.example.com/lead/123" } }`, **When** the email is rendered, **Then** the CTA button shows "View in CRM" and clicking it opens `https://crm.example.com/lead/123` in a new tab.
2. **Given** `ctaButton: { text: "Reply to Jane", action: { type: "mailto", email: "jane@example.com" } }`, **When** the email is rendered, **Then** the CTA button shows "Reply to Jane" and clicking it opens the user's mail client addressed to `jane@example.com`.
3. **Given** no `ctaButton` field in the payload, **When** the email is rendered, **Then** the existing default button behaviour is preserved — button text is "Reply to {submitter name or email}" and clicking it opens a mailto to the submitter.
4. **Given** `ctaButton` with only `text` and no `action`, **When** the email is rendered, **Then** the default action (mailto to submitter) is used with the custom text — partial overrides are supported.

---

### User Story 3 — Combined: Email Suppressed, Custom CTA in Future Emails (Priority: P2)

A calling application needs to collect form data silently for some submissions (no email) while still sending a customised notification email for others — all using the same client configuration. The two controls (`sendEmail` and `ctaButton`) work independently and can be combined or omitted freely per invocation.

**Why this priority**: This story validates that the two new controls are orthogonal and compose correctly. It does not require new code beyond Stories 1 and 2 but needs explicit test coverage.

**Independent Test**: Fire two events from the same client — one with `sendEmail: false`, one with `ctaButton: { ... }` and no `sendEmail` — and confirm each behaves correctly in isolation.

**Acceptance Scenarios**:

1. **Given** `sendEmail: false` and `ctaButton: { text: "View", action: { type: "url", url: "..." } }`, **When** the workflow runs, **Then** no email is sent regardless of the CTA configuration.
2. **Given** `sendEmail: true` and `ctaButton` with a URL action, **When** the workflow runs, **Then** the email is sent with the custom CTA button.
3. **Given** neither field in the payload, **When** the workflow runs, **Then** behaviour is identical to today — email sent, default CTA.

---

### Edge Cases

- What if `ctaButton.action.type` is an unrecognised value? → Fall back to the default mailto action; log a warning.
- What if `ctaButton.action.url` is missing when `type` is `"url"`? → Fall back to default action; log a warning.
- What if `ctaButton.action.email` is missing when `type` is `"mailto"`? → Fall back to the submitter's email (the existing default behaviour).
- What if `sendEmail: false` is set but `EMAIL_MODE=mock`? → No email would have been sent anyway; step is still skipped and logged.
- What if `ctaButton.text` is an empty string? → Fall back to the default button text while using the provided action.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `form/submitted` event payload MUST accept an optional `sendEmail` boolean field.
- **FR-002**: When `sendEmail` is `false`, the email send step MUST be skipped; no email is attempted and the skip is recorded in the workflow log.
- **FR-003**: When `sendEmail` is `true` or omitted, email sending behaviour MUST be identical to the current implementation.
- **FR-004**: The `form/submitted` event payload MUST accept an optional `ctaButton` object containing an optional `text` string and an optional `action` object.
- **FR-005**: The `ctaButton.action` object MUST support two types: `"url"` (opens a provided link in a new tab) and `"mailto"` (opens email client — existing default).
- **FR-006**: When `ctaButton.text` is provided and non-empty, it MUST replace the default CTA button label in the rendered email.
- **FR-007**: When `ctaButton.action.type` is `"url"`, the button MUST link to `ctaButton.action.url` and open it in a new browser tab.
- **FR-008**: When `ctaButton.action.type` is `"mailto"`, the button MUST open a mailto link. If `ctaButton.action.email` is provided, it is used as the recipient; otherwise the submitter's email is used.
- **FR-009**: When `ctaButton` is omitted entirely, the default CTA button behaviour MUST be preserved unchanged.
- **FR-010**: Invalid or unrecognised `ctaButton.action.type` values MUST fall back to the default action silently, with a warning logged.
- **FR-011**: The `sendEmail` and `ctaButton` controls MUST be independent — setting one MUST NOT affect the other's behaviour.
- **FR-012**: No database schema changes are required — both fields live in the event payload only.

### Key Entities

- **`FormNotificationCtaButton`**: Optional payload object — `text?: string`, `action?: { type: "url"; url: string } | { type: "mailto"; email?: string }`.
- **`FormSubmittedPayload`** (extended): Gains `sendEmail?: boolean` and `ctaButton?: FormNotificationCtaButton`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A calling application can suppress email notification for any individual form submission without changing stored client configuration.
- **SC-002**: A calling application can replace the CTA button label and link target in the notification email per submission, without changing email templates or client settings.
- **SC-003**: Omitting both new fields from the payload produces behaviour identical to the pre-018 implementation — full backwards compatibility.
- **SC-004**: The feature ships with no database schema changes and no required client record updates.
- **SC-005**: Both controls work independently and can be freely combined, omitted, or mixed within the same client's submissions.

---

## Assumptions

1. **No DB schema changes**: Both fields are payload-only. No new columns needed.
2. **`sendEmail` skip is not an error**: When `sendEmail: false`, the workflow outcome is `"skipped"` not `"failed"`. The Sheets sync and log steps still run.
3. **CTA button lives in the email template**: The button rendering change is isolated to the React Email template for form notifications. No other email templates are affected.
4. **Partial `ctaButton` overrides are supported**: Providing only `text` (no `action`) uses the default action with the custom label; providing only `action` (no `text`) uses the default label with the custom action.
5. **URL validation**: Basic validation — `url` must be a non-empty string starting with `http://` or `https://`. No DNS lookup. Invalid URLs fall back to default with a warning.
6. **`sendEmail` defaulting**: The absence of the field is treated identically to `sendEmail: true` — no change to existing behaviour.
