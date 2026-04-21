# Feature Specification: Per-Client Timezone for 9 AM Local Delivery

**Feature Branch**: `022-client-timezone`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Per-client timezone support so analytics report emails always arrive at 9 AM in the client local time regardless of daylight saving time. US timezones only: ET CT MT PT."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Client Receives Report at 9 AM Their Local Time (Priority: P1)

A client configured to Eastern Time always receives their monthly analytics report at 9 AM ET — whether that's 9 AM EST in winter or 9 AM EDT in summer. They never need to think about DST shifts, UTC offsets, or when the scheduler fires.

**Why this priority**: This is the core value of the feature. Without it, clients in PT receive emails at 6 AM or 2 AM depending on the season — a poor experience that erodes trust in the report cadence.

**Independent Test**: Configure a test client to each of the four US timezones and trigger the scheduler. Confirm each client's report event is scheduled for exactly 9 AM in their configured timezone, accounting for the current DST status.

**Acceptance Scenarios**:

1. **Given** a client is configured to Eastern Time, **When** the monthly scheduler runs in January (EST, UTC-5), **Then** the client's report is delivered at 9 AM ET (14:00 UTC).
2. **Given** a client is configured to Eastern Time, **When** the monthly scheduler runs in July (EDT, UTC-4), **Then** the client's report is delivered at 9 AM ET (13:00 UTC).
3. **Given** clients are configured to ET, CT, MT, and PT respectively, **When** the scheduler runs, **Then** each client receives their report at 9 AM in their own timezone — all on the same calendar date.

---

### User Story 2 — Business Day Check Uses Client's Local Date (Priority: P1)

The business-day enforcement (no weekends, no US federal holidays) is evaluated in the client's local timezone — not UTC. A PT client whose report would otherwise arrive at 9 AM on a Monday should not be penalised because that Monday is still Sunday UTC.

**Why this priority**: Without this, the business-day logic produces incorrect results for clients in negative UTC offsets. A report could be deferred a full day for a PT client simply because the UTC date check fired on the "wrong" day.

**Independent Test**: Trigger the scheduler when the UTC date is a Sunday but the client's local date (PT) is still Saturday — confirm the business-day check defers based on the client's local date, not the UTC date.

**Acceptance Scenarios**:

1. **Given** the send date is a Monday in all US timezones, **When** the scheduler fires, **Then** all clients receive their report on that Monday (no deferral for any timezone).
2. **Given** a client is in PT and their local send date falls on a Saturday, **When** the business-day check runs, **Then** the report is deferred to Monday PT — even if the UTC date is already Sunday.
3. **Given** a client's local send date falls on a US federal holiday, **When** the business-day check runs, **Then** the report is deferred to the next valid business day in the client's local timezone.

---

### User Story 3 — Timezone Stored and Validated on Client Record (Priority: P2)

Each client record stores a timezone from a fixed allowlist of four US IANA timezone names. Invalid or unsupported timezones are rejected at write time with a clear error. Clients without an explicitly set timezone default to Central Time.

**Why this priority**: The delivery logic depends entirely on a valid timezone being present. A missing or invalid value would silently break report delivery for that client.

**Independent Test**: Attempt to set a client's timezone to each valid value and confirm acceptance. Attempt an invalid value and confirm rejection. Confirm a client with no timezone set receives their report at 9 AM CT.

**Acceptance Scenarios**:

1. **Given** a client record is updated with `America/New_York`, `America/Chicago`, `America/Denver`, or `America/Los_Angeles`, **When** the update is saved, **Then** it is accepted and stored.
2. **Given** a client record is updated with an unsupported value (e.g. `Europe/London`, `UTC`, `EST`), **When** the update is attempted, **Then** it is rejected with a validation error.
3. **Given** an existing client has no timezone configured, **When** the scheduler runs, **Then** the client's report is delivered at 9 AM CT (the default).

---

### Edge Cases

- What happens if the scheduler fires and a client's 9 AM in their timezone has already passed for that calendar day? The worker sends immediately rather than waiting until the following day — the tolerance window is the same calendar date.
- What happens if DST transition occurs between the scheduler firing and a client's 9 AM? The timezone name (e.g. `America/Chicago`) encodes DST rules — the computed 9 AM UTC target is always correct for the actual send date.
- What happens if a client's local business-day check keeps deferring and crosses midnight into a new day with a different UTC offset? The business-day check and send-time computation are always evaluated fresh against the current candidate date in the client's local timezone.
- What happens to existing clients with no timezone value after this feature is deployed? They default to `America/Chicago` (CT) — consistent with the previous fixed UTC send time of 2 PM UTC which approximated 8 AM CT.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each client record MUST store a timezone value from the approved US allowlist: Eastern (`America/New_York`), Central (`America/Chicago`), Mountain (`America/Denver`), Pacific (`America/Los_Angeles`).
- **FR-002**: The timezone field MUST default to `America/Chicago` (Central Time) for clients without an explicitly configured value.
- **FR-003**: The system MUST reject any timezone value not in the approved allowlist at the point of write, returning a clear validation error.
- **FR-004**: The monthly analytics scheduler MUST fire at midnight UTC on the 2nd of each month so that 9 AM in all supported US timezones is always in the future at trigger time.
- **FR-005**: For each client, the system MUST compute the next occurrence of 9 AM in the client's configured timezone and delay delivery until that time — accounting for the current DST status automatically.
- **FR-006**: The business-day check (weekends and US federal holidays) MUST be evaluated against the client's local calendar date, not the UTC date.
- **FR-007**: If a client's computed 9 AM send time has already passed for the current calendar day (e.g. scheduler delay), the system MUST send immediately rather than deferring to the following day.
- **FR-008**: DST transitions MUST be handled transparently — clients always receive their report at 9 AM local clock time regardless of whether DST is currently active.
- **FR-009**: The weekly analytics scheduler MUST apply the same per-client timezone logic as the monthly scheduler.

### Key Entities

- **Client Timezone**: A per-client configuration value from the four-value US allowlist. Determines both the send time (9 AM local) and the reference date for business-day evaluation. Defaults to Central Time.
- **Supported Timezone Allowlist**: The fixed set of four IANA timezone names corresponding to ET, CT, MT, PT. Validated at write time; referenced at send time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every client receives their analytics report within a 5-minute window of 9 AM in their configured timezone, for 100% of monthly sends.
- **SC-002**: DST transitions produce zero incorrectly-timed deliveries — verified across at least two DST boundary dates (spring-forward and fall-back) in testing.
- **SC-003**: All four supported US timezones deliver correctly at 9 AM local time on the same calendar date, within the same scheduler run.
- **SC-004**: Invalid timezone values are rejected 100% of the time at write — no invalid timezone ever reaches the send logic.
- **SC-005**: Existing clients with no timezone configured default to Central Time with zero disruption to their existing report cadence.

## Assumptions

- US timezones only for this feature; international timezones are explicitly out of scope and deferred.
- The four IANA timezone names (`America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`) cover all current and anticipated US clients.
- "9 AM local time" means 09:00:00 in the client's wall-clock time — not a range.
- The existing business-day holiday set (US federal holidays + Christmas Eve + day after Christmas + New Year's Eve) applies uniformly to all clients regardless of timezone.
- No new external dependencies are required — DST-aware timezone math is available in the runtime environment without additional packages.
- Both the weekly and monthly analytics schedulers are in scope; other notification workflows (e.g. form notifications) are not affected.
