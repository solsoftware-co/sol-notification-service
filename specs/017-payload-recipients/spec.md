# Feature Specification: Per-Invocation Recipient Override

**Feature Branch**: `017-payload-recipients`  
**Created**: 2026-04-13  
**Status**: Draft

## Overview

Calling applications need to specify who receives the form notification email on a per-submission basis, not just at the client configuration level. A client that operates multiple websites with different forms needs different recipients for each form without changing their stored configuration. This feature adds an optional `recipients` field to the form submission event payload with a clear three-tier fallback chain.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Payload Recipients Used When Provided (Priority: P1)

A calling application submits a form event with a `recipients` field containing one or more email addresses. Those addresses — and only those addresses — receive the notification email for that submission. The stored client configuration is not consulted for recipient resolution.

**Why this priority**: This is the primary use case motivating the feature. Without it, multi-site clients cannot route form notifications to different teams per site.

**Independent Test**: Fire a `form/submitted` event with a `recipients` array; confirm the email is delivered (or logged in mock mode) to exactly those addresses, regardless of what is stored in `client.email` or `settings`.

**Acceptance Scenarios**:

1. **Given** a `form/submitted` event with `recipients: ["alice@example.com", "bob@example.com"]`, **When** the workflow runs, **Then** the email is sent to both `alice@example.com` and `bob@example.com`.
2. **Given** a `form/submitted` event with `recipients: ["alice@example.com"]` and the client has a different `settings.notifications.form_submitted` list, **When** the workflow runs, **Then** only `alice@example.com` receives the email (settings list ignored).
3. **Given** a `form/submitted` event with `recipients: ["alice@example.com", "alice@example.com"]`, **When** the workflow runs, **Then** `alice@example.com` receives exactly one email (duplicates deduplicated).

---

### User Story 2 — Fallback to Stored Configuration When No Payload Recipients (Priority: P1)

A calling application submits a form event without a `recipients` field. The workflow falls back to the existing two-tier resolution: the per-workflow settings list if configured, otherwise the client's primary email address. Existing behavior is fully preserved.

**Why this priority**: Backwards compatibility is critical. All existing integrations that do not send `recipients` must continue to work without any changes.

**Independent Test**: Fire a `form/submitted` event without `recipients`; confirm behavior matches what existed before this feature — settings list or `client.email` used as before.

**Acceptance Scenarios**:

1. **Given** a `form/submitted` event with no `recipients` field, and the client has `settings.notifications.form_submitted: ["team@example.com"]`, **When** the workflow runs, **Then** the email is sent to `team@example.com`.
2. **Given** a `form/submitted` event with no `recipients` field, and the client has no `settings.notifications.form_submitted`, **When** the workflow runs, **Then** the email is sent to `client.email`.
3. **Given** a `form/submitted` event with `recipients: []` (empty array), **When** the workflow runs, **Then** the system treats this as absent and falls back to stored configuration (same as Story 2, Scenario 1 or 2).

---

### User Story 3 — Invalid Recipients Handled Gracefully (Priority: P2)

A calling application accidentally includes a malformed email address in the `recipients` list alongside valid addresses. The notification still delivers to the valid addresses; the invalid entry is ignored and recorded in the notification log. If all provided addresses are invalid, the system falls back to stored configuration.

**Why this priority**: Graceful degradation prevents a typo from silently dropping notifications entirely.

**Independent Test**: Fire a `form/submitted` event with `recipients: ["valid@example.com", "not-an-email"]`; confirm email reaches `valid@example.com` and the log entry captures the invalid address.

**Acceptance Scenarios**:

1. **Given** `recipients: ["valid@example.com", "not-an-email"]`, **When** the workflow runs, **Then** only `valid@example.com` receives the email, and the notification log metadata records the skipped invalid address.
2. **Given** `recipients: ["not-an-email"]` (all invalid), **When** the workflow runs, **Then** the system falls back to stored configuration (settings list or `client.email`) and the log records the fallback reason.

---

### Edge Cases

- What happens when `recipients` is present but contains only whitespace strings? → Treated as empty after trimming; falls back to stored configuration.
- What happens when a recipient email is valid but the delivery fails? → Existing email error handling applies; recipient resolution is unaffected.
- What happens in test/mock email modes? → Recipient resolution runs normally, but actual delivery is intercepted per the existing mode rules (mock logs to file, test mode redirects to `TEST_EMAIL`).
- What happens when `recipients` contains 50+ addresses? → No hard cap imposed by this feature; delivery constraints are the email provider's concern.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `form/submitted` event payload MUST accept an optional `recipients` field containing an array of email address strings.
- **FR-002**: When `recipients` is provided and contains at least one valid email address, the system MUST use those addresses as the sole recipients for that notification, ignoring stored configuration.
- **FR-003**: When `recipients` is absent, `null`, or an empty array, the system MUST fall back to the existing two-tier resolution: `settings.notifications.form_submitted` list first, then `client.email`.
- **FR-004**: The system MUST deduplicate recipient addresses before sending (case-insensitive comparison).
- **FR-005**: The system MUST validate each address in `recipients` against a standard email format before use; invalid addresses MUST be silently discarded with the reason recorded in log metadata.
- **FR-006**: When all addresses in `recipients` are invalid, the system MUST fall back to stored configuration as if `recipients` were absent, and MUST record the fallback reason in the notification log metadata.
- **FR-007**: The notification log entry MUST include a `recipient_source` metadata field indicating which tier resolved the recipients: `"payload"`, `"settings"`, or `"client_email"`.
- **FR-008**: The resolution logic MUST be encapsulated in the existing `resolveRecipients` function (or its direct replacement), not duplicated in the workflow function.
- **FR-009**: All existing behaviour for events that do not include `recipients` MUST remain unchanged — no migration or client-side changes required.

### Key Entities

- **FormSubmittedPayload**: Extended with optional `recipients?: string[]` field.
- **RecipientResolutionResult**: The resolved list of email addresses plus the source tier (`"payload"` | `"settings"` | `"client_email"`), used for logging.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A calling application can override notification recipients per form submission without any change to stored client configuration.
- **SC-002**: All existing form notification flows that omit `recipients` continue to deliver to the correct addresses with zero changes to calling applications.
- **SC-003**: The recipient source (`payload`, `settings`, or `client_email`) is recorded in every notification log entry, making delivery auditable.
- **SC-004**: Invalid email addresses in a payload `recipients` list never cause a notification to be silently dropped — either valid addresses receive it, or the fallback chain ensures delivery.
- **SC-005**: The feature ships with no database schema changes and no required client record updates.

---

## Assumptions

1. **No DB schema changes**: The `recipients` field lives in the event payload only. No new columns are needed.
2. **`resolveRecipients` updated, not replaced**: The function in `src/lib/notifications.ts` is updated to accept an optional payload recipients list as its top tier, preserving the existing settings + client.email fallback logic.
3. **Test/mock mode delivery interception is orthogonal**: Recipient resolution runs correctly in all email modes. What changes in test/mock mode is *where* the email is delivered, not *who* was resolved.
4. **Email validation**: A simple RFC 5322-compatible regex check is sufficient; no DNS/MX lookup required.
5. **Case-insensitive deduplication**: `Alice@Example.com` and `alice@example.com` are treated as the same recipient.
6. **Empty string and whitespace-only entries**: Treated as invalid and discarded before fallback evaluation.
