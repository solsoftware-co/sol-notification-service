# Feature Specification: Per-Client Notification Preferences

**Feature Branch**: `014-notification-preferences`  
**Created**: 2026-04-09  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Form submission alerts go to the right people (Priority: P1)

A client wants form submission notifications delivered to their sales team, not just the primary contact on file. They configure a recipient list specifically for form submissions. When a visitor submits a contact form, the notification goes to everyone on that list. If no list is configured, the notification falls back to the client's primary email.

**Why this priority**: This is the core value of the feature — ensuring the right people receive the right notification type. The fallback to `client.email` ensures zero disruption for clients who haven't configured preferences.

**Independent Test**: Seed a client with a `form_submitted` recipient list, trigger a form submission event, and verify the email is sent to each address on the list instead of the primary email.

**Acceptance Scenarios**:

1. **Given** a client has a `form_submitted` recipient list configured with two addresses, **When** a form submission event fires for that client, **Then** the notification is sent to both addresses on the list.
2. **Given** a client has no `form_submitted` recipient list configured, **When** a form submission event fires, **Then** the notification falls back to the client's primary email address.
3. **Given** a client has an empty `form_submitted` recipient list, **When** a form submission event fires, **Then** the notification falls back to the client's primary email address.

---

### User Story 2 - Analytics reports go to the right people (Priority: P2)

A client wants weekly analytics reports sent to their marketing team, separate from who receives form notifications. They configure an `analytics_report` recipient list. When the weekly report runs, it is delivered to all addresses on that list. If no list is configured, it falls back to the client's primary email.

**Why this priority**: Completes the feature for the two existing workflow types. Each workflow independently respects preferences, allowing fully disjoint or overlapping recipient sets.

**Independent Test**: Seed a client with an `analytics_report` recipient list, trigger an analytics report event, and verify the email is sent only to the analytics list addresses.

**Acceptance Scenarios**:

1. **Given** a client has an `analytics_report` recipient list with one address, **When** the analytics report workflow runs for that client, **Then** the report is sent to that address (not the primary email).
2. **Given** a client has no `analytics_report` recipient list, **When** the analytics report workflow runs, **Then** the report falls back to the client's primary email address.

---

### User Story 3 - New notification types automatically respect the same pattern (Priority: P3)

When a future notification workflow is added to the system, it can declare which preference key to look up. If a client has configured recipients for that key, they are used; otherwise the primary email is the fallback. No changes to the client data model are needed to support a new workflow type.

**Why this priority**: Establishes the extensibility pattern. Future workflows should not require data migrations to support per-client recipient configuration.

**Independent Test**: Add a hypothetical new workflow, point it at a new preference key (e.g. `invoice_sent`), seed a client with that key, and verify it resolves recipients correctly without schema changes.

**Acceptance Scenarios**:

1. **Given** a new workflow references a preference key that a client has configured, **When** that workflow runs, **Then** recipients are resolved from the configured list.
2. **Given** a new workflow references a preference key that a client has not configured, **When** that workflow runs, **Then** it falls back to the client's primary email.

---

### Edge Cases

- What happens when a recipient list contains one or more invalid email addresses? The system should skip invalid addresses and still deliver to valid ones, logging a warning for each skipped address.
- What happens when a recipient list contains only invalid addresses? The system should fall back to the client's primary email and log a warning.
- What happens when the client record itself is not found? Existing error handling applies — the workflow fails as it does today.
- What happens when the client's primary email is also invalid (fallback scenario)? The workflow fails with a clear error, same as current behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each client MAY have a notification preferences configuration that maps workflow types to a list of recipient email addresses.
- **FR-002**: For each workflow, the system MUST resolve recipients by checking the client's notification preferences for the corresponding workflow type key.
- **FR-003**: If the client has a non-empty, valid recipient list for the workflow type, the system MUST send the notification to all addresses in that list.
- **FR-004**: If the client has no recipient list configured for the workflow type, or the list is empty, the system MUST fall back to the client's primary email address.
- **FR-005**: The `form/submitted` workflow MUST resolve recipients using the `form_submitted` preference key.
- **FR-006**: The analytics report workflow MUST resolve recipients using the `analytics_report` preference key.
- **FR-007**: The notification preferences configuration MUST be stored within the existing client record — no new data entities are required.
- **FR-008**: Adding a new workflow type MUST NOT require changes to the client data model.
- **FR-009**: The system MUST log which recipient addresses were used for each notification send, including whether the fallback path was taken.

### Key Entities

- **Client**: An existing entity representing a business account. Gains an optional `notifications` map within its settings, where each key is a workflow type identifier (e.g. `form_submitted`, `analytics_report`) and each value is a list of recipient email addresses.
- **Notification Preferences**: A logical structure nested within a client's settings. Not a standalone entity — it lives inside the client record. Maps workflow type → `string[]` of recipient emails.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing clients who have no notification preferences configured continue to receive notifications without any change in behavior (zero regression).
- **SC-002**: A client with a configured recipient list for a given workflow receives notifications exclusively at those addresses — the primary email is not included unless explicitly listed.
- **SC-003**: The fallback to primary email is exercised automatically with no manual intervention when preferences are absent or empty.
- **SC-004**: No changes to the database schema are required to store or extend notification preferences for any client.
- **SC-005**: Adding a new workflow type that respects notification preferences requires changes only to the workflow function — no data migrations, no changes to shared infrastructure.

## Testing Requirements *(mandatory)*

### Unit Tests

- The recipient resolution helper MUST have tests covering:
  - A client with a valid, non-empty recipient list for the requested workflow key → returns the list
  - A client with no `notifications` key in settings → returns the primary email as fallback
  - A client with the workflow key present but the list is empty → returns the primary email as fallback
  - A client with a mix of valid and invalid addresses in the list → returns only valid addresses, logs a warning for each skipped address; if all are invalid, falls back to primary email

- The `form/submitted` workflow MUST have tests covering:
  - Recipient resolution uses the `form_submitted` preference key
  - Email is sent to the resolved recipient list (not hard-coded to `client.email`)
  - Fallback to `client.email` when no preference is configured

- The analytics report workflow MUST have tests covering:
  - Recipient resolution uses the `analytics_report` preference key
  - Email is sent to the resolved recipient list
  - Fallback to `client.email` when no preference is configured

### Regression

- All existing unit and end-to-end tests MUST continue to pass without modification. Clients without notification preferences configured must behave identically to today.

## Assumptions

- The existing `settings JSONB` column on the `clients` table is the storage location for notification preferences. The structure will be `settings.notifications.<workflow_key>: string[]`.
- Recipient resolution is the responsibility of each workflow function — there is no centralized routing layer.
- The feature covers the two existing email workflows: form notification and analytics report. Other future workflows are out of scope for this spec but should be supported by the pattern.
- A shared helper function will resolve recipients given a client record and a workflow key, to avoid duplicating the fallback logic in each workflow.
- Multiple recipients are delivered in a single email send (to array), not one send per recipient.
