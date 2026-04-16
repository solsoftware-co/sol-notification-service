# Feature Specification: Per-Client Email Banner Configuration

**Feature Branch**: `019-client-email-banner`
**Created**: 2026-04-16
**Status**: Draft

## Overview

Every outbound email (form notification and analytics report) includes a banner image at the top. Currently the banner is identical for every client — it uses a single hardcoded image at a fixed height. This feature allows each client to supply their own banner image and specify the display dimensions that suit their logo's orientation, so that emails feel on-brand for each client rather than generic.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Client displays their own logo in emails (Priority: P1)

An operator configures a client record with a custom banner image URL. All subsequent emails sent for that client display the client's logo instead of the default banner.

**Why this priority**: This is the core value of the feature. Without a custom image, nothing else matters.

**Independent Test**: Configure a client with a custom banner image URL, trigger a form notification email, and confirm the rendered email displays the custom image.

**Acceptance Scenarios**:

1. **Given** a client has a banner image URL configured, **When** a form notification email is rendered for that client, **Then** the email displays the client's banner image.
2. **Given** a client has a banner image URL configured, **When** an analytics report email is rendered for that client, **Then** the email displays the client's banner image.
3. **Given** a client has no banner image configured, **When** any email is rendered for that client, **Then** the email falls back to the default banner image.

---

### User Story 2 — Client controls banner dimensions to match logo orientation (Priority: P2)

An operator configures width and/or height values for a client's banner to accommodate logos that are taller (portrait), wider (landscape), or square compared to the default dimensions.

**Why this priority**: A correct image at wrong dimensions looks broken. Dimension control is needed alongside the image URL for the feature to be usable.

**Independent Test**: Configure a client with a custom height and/or width, render an email, and verify the banner renders at the specified dimensions.

**Acceptance Scenarios**:

1. **Given** a client has a custom banner height configured, **When** an email is rendered, **Then** the banner image is displayed at the specified height.
2. **Given** a client has a custom banner width configured, **When** an email is rendered, **Then** the banner image is displayed at the specified width.
3. **Given** a client has both height and width configured, **When** an email is rendered, **Then** both dimensions are applied.
4. **Given** a client has no dimensions configured, **When** an email is rendered, **Then** the banner renders at the default dimensions.

---

### User Story 3 — Banner configuration is validated before use (Priority: P3)

When banner configuration is stored for a client, invalid values (e.g. non-positive dimensions, malformed image URL) are rejected before they can produce broken emails.

**Why this priority**: Silent misconfiguration is worse than a clear error. However, this is lower priority than the core render behaviour.

**Independent Test**: Attempt to store a banner config with an invalid URL or zero-value dimension and confirm the operation is rejected with a descriptive error.

**Acceptance Scenarios**:

1. **Given** a banner image URL is provided, **When** the URL is not a valid absolute URL, **Then** the configuration is rejected with a descriptive error.
2. **Given** a banner dimension is provided, **When** the value is zero or negative, **Then** the configuration is rejected with a descriptive error.
3. **Given** valid banner configuration is provided, **When** it is saved, **Then** it is accepted and persisted without modification.

---

### Edge Cases

- What happens when the configured banner image URL is unreachable at render time? The system falls back to the default banner rather than failing the email send.
- What happens when only one dimension (height OR width) is configured? The unspecified dimension falls back to its default independently.
- What happens when a client's banner config is partially invalid (e.g. valid URL, invalid dimension)? The invalid field is ignored and falls back to its default; valid fields are applied.
- What happens when the default fallback image is also unavailable? The email sends without a banner rather than failing entirely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a banner image source to be configured per client.
- **FR-002**: The system MUST allow a banner display height to be configured per client, expressed as a positive integer (pixels).
- **FR-003**: The system MUST allow a banner display width to be configured per client, expressed as a positive integer (pixels).
- **FR-004**: The system MUST apply the client's banner configuration to all email types sent for that client (form notification and analytics report).
- **FR-005**: The system MUST fall back to the default banner image when no custom image is configured for a client.
- **FR-006**: The system MUST fall back to default dimensions when no custom dimensions are configured for a client.
- **FR-007**: The system MUST fall back to the default banner when the configured image source cannot be resolved at render time, without failing the email send.
- **FR-008**: The system MUST store banner configuration within the existing per-client settings structure — no new database tables are required.
- **FR-009**: The system MUST reject banner image sources that are not valid absolute URLs.
- **FR-010**: The system MUST reject banner dimension values that are not positive integers.

### Key Entities

- **Client Banner Config**: A sub-object within a client's settings containing:
  - `imageUrl` — absolute URL pointing to the banner image to embed in emails
  - `height` — display height in pixels (positive integer)
  - `width` — display width in pixels (positive integer)
  - All fields are optional; absent fields fall back to system defaults.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Emails rendered for a client with a custom banner configuration display the client's image in 100% of cases when the image source is reachable.
- **SC-002**: Emails rendered for a client with no banner configuration are visually identical to current behaviour — zero regressions for existing clients.
- **SC-003**: When a configured banner image is unreachable at render time, the email is still delivered successfully — zero send failures caused by banner resolution errors.
- **SC-004**: Both email types (form notification, analytics report) respect client banner config after implementation — neither type remains on the hardcoded default.
- **SC-005**: Invalid banner configuration (bad URL, non-positive dimensions) is caught before persistence, preventing misconfigured clients from producing broken emails.

## Assumptions

- Banner images are hosted at publicly accessible URLs (e.g. a CDN or object storage bucket). The notification service fetches and embeds them at render time as inline attachments — it does not store or proxy images itself.
- The default banner image and dimensions remain unchanged for clients without custom configuration, ensuring zero visual regression for existing clients.
- Width and height are independent — configuring only one dimension is valid; the other falls back to its default independently.
- No UI is in scope for this feature. Banner configuration is set directly on the client record (e.g. via a seed script or database update).
- Image format support is limited to formats that email clients can render inline (PNG, JPEG, GIF, WebP). Format validation is out of scope for this feature.
