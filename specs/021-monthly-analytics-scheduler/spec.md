# Feature Specification: Monthly Analytics Report Scheduler

**Feature Branch**: `021-monthly-analytics-scheduler`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "Monthly analytics report scheduler with US business day enforcement — fires on the 2nd of each month at 9 AM, waits forward day-by-day if the date falls on a weekend or US federal holiday, dispatches last_month analytics report events once a valid business day is reached"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Monthly Report Lands on a Business Day (Priority: P1)

Every month, each active client automatically receives a "last month" analytics report email on the first valid US business day on or after the 2nd. The report is identical in content to a manually-triggered monthly analytics report.

**Why this priority**: This is the core scheduling contract. All other stories depend on the scheduler correctly identifying and targeting a valid send date.

**Independent Test**: Trigger the scheduler on a known weekday non-holiday and confirm that all active clients receive a `last_month` report event with the correct send date.

**Acceptance Scenarios**:

1. **Given** the 2nd of the month falls on a Tuesday (non-holiday), **When** the scheduler fires at 9 AM, **Then** all active clients receive a monthly analytics report event for the previous month with `scheduledAt` set to that Tuesday.
2. **Given** active clients exist in the system, **When** the scheduler dispatches, **Then** one report event with a `last_month` period is emitted per active client.
3. **Given** no active clients exist, **When** the scheduler fires, **Then** no report events are dispatched and the run completes without error.

---

### User Story 2 — Scheduler Skips Weekends and Waits for Next Day (Priority: P1)

When the 2nd falls on a Saturday or Sunday, the scheduler waits — checking once per day at 9 AM — until it reaches a weekday that is not a US federal holiday, then sends.

**Why this priority**: Without this, reports would either not send or send on a weekend when no one is watching. The skip-and-retry logic is the defining behaviour of this feature.

**Independent Test**: Trigger the scheduler with a date known to be a Saturday and confirm it sleeps, retries on Sunday (skips again), and dispatches on Monday.

**Acceptance Scenarios**:

1. **Given** the 2nd is a Saturday, **When** the scheduler fires, **Then** it does not dispatch any events on Saturday; it waits and checks again at 9 AM Sunday.
2. **Given** the 2nd is a Saturday and the 3rd (Sunday) is also non-eligible, **When** the scheduler checks on Sunday, **Then** it waits again and dispatches on Monday the 4th (assuming it is not a holiday).
3. **Given** the scheduler is waiting for a valid day, **When** it wakes and finds a non-holiday weekday, **Then** it immediately dispatches all active client events.

---

### User Story 3 — Scheduler Skips US Federal Holidays (Priority: P2)

When the target send date falls on a US federal holiday (including observed holidays when the actual date falls on a weekend), the scheduler defers to the following day and checks again.

**Why this priority**: Holiday awareness prevents reports from landing in inboxes on days when recipients are out of office, reducing noise and missed engagement.

**Independent Test**: Trigger the scheduler with a date set to a known US federal holiday and confirm it defers to the next calendar day before dispatching.

**Acceptance Scenarios**:

1. **Given** the 2nd falls on a US federal holiday, **When** the scheduler fires, **Then** it defers and checks the 3rd.
2. **Given** the 2nd falls on any of the 11 US federal holidays (or their observed equivalents), **When** the scheduler fires, **Then** no events are dispatched that day.
3. **Given** multiple consecutive days are non-eligible (e.g., a holiday on Friday followed by a weekend), **When** the scheduler wakes each day, **Then** it keeps deferring until a valid business day is found.

---

### User Story 4 — Manual Trigger for Ad-Hoc Monthly Reports (Priority: P3)

An operator can manually trigger the monthly scheduler at any time. The same business-day enforcement applies — if the trigger date is not a valid US business day, the scheduler waits forward exactly as it would for the automated cron.

**Why this priority**: Supports re-runs after incidents, environment testing, and on-demand reporting without bypassing the date safety logic.

**Independent Test**: Send a manual trigger event and confirm the scheduler applies the same weekday/holiday check before dispatching.

**Acceptance Scenarios**:

1. **Given** an operator sends a manual trigger event on a valid business day, **When** the scheduler processes it, **Then** all active clients receive a monthly report event immediately.
2. **Given** an operator sends a manual trigger event on a Saturday, **When** the scheduler processes it, **Then** it defers to the next valid business day before dispatching, identical to the automated path.

---

### Edge Cases

- What happens when every day for 7 consecutive days is non-eligible? The scheduler gives up after 7 days without dispatching and logs a skip outcome — this prevents an unbounded wait.
- What happens when a US federal holiday falls on a Sunday and is observed on Monday, and that Monday is the 2nd? The scheduler treats Monday as a holiday (observed) and defers to Tuesday.
- What happens when a client has no GA4 property configured? The existing monthly report worker handles this skip — the scheduler itself is unaffected.
- What happens in non-production environments? The same testOnly/limit guardrails from the weekly scheduler apply: only 1 test client is targeted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scheduler MUST fire automatically at 9:00 AM UTC on the 2nd of every month.
- **FR-002**: The scheduler MUST support a manual trigger event that invokes the same business-day logic as the automated cron.
- **FR-003**: On each check, the scheduler MUST evaluate whether the current date is a US non-holiday weekday (Monday–Friday, excluding all 11 US federal holidays and their observed equivalents).
- **FR-004**: If the current date is not a valid US business day, the scheduler MUST defer and recheck at 9:00 AM UTC the following calendar day — repeating until a valid day is found or 7 days have elapsed.
- **FR-005**: If no valid business day is found within 7 consecutive days, the scheduler MUST log a skip outcome and terminate without dispatching any events.
- **FR-006**: When a valid business day is identified, the scheduler MUST dispatch one monthly analytics report event per active client with a `last_month` reporting period and `scheduledAt` set to the valid business day's date.
- **FR-007**: In non-production environments, the scheduler MUST restrict dispatch to at most 1 test-flagged client (identical behaviour to the existing weekly scheduler).
- **FR-008**: The scheduler MUST allow at most one concurrent execution at a time to prevent duplicate monthly dispatches.
- **FR-009**: The 11 US federal holidays recognised MUST include: New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Memorial Day, Juneteenth National Independence Day, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving Day, and Christmas Day — each adjusted to their observed date when the actual date falls on a Saturday (observe Friday) or Sunday (observe Monday).

### Key Entities

- **Scheduler Run**: A single execution of the monthly scheduler, identified by the month it targets. Has a trigger date (the 2nd), a resolved send date (first valid business day on or after the 2nd), and a dispatch count.
- **US Federal Holiday**: A named calendar date (or its observed equivalent) on which the scheduler must not dispatch. Computed per calendar year from fixed and floating rules.
- **Active Client**: An existing client record marked active in the system. The scheduler's client list is identical to that used by the weekly scheduler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Monthly analytics report events are dispatched on the first valid US business day on or after the 2nd of each month, with zero manual intervention required.
- **SC-002**: When the 2nd falls on a weekend or holiday, dispatch is deferred to the correct next valid business day in 100% of cases.
- **SC-003**: All 11 US federal holidays (and their Saturday/Sunday observed equivalents) are correctly identified as non-dispatch days.
- **SC-004**: The scheduler never dispatches more than once per calendar month per client under normal operating conditions.
- **SC-005**: In the event of a 7-day all-non-business-day streak (theoretical edge case), the scheduler terminates gracefully with a logged skip outcome rather than running indefinitely.
- **SC-006**: Non-production runs never dispatch to more than 1 client, preventing accidental bulk sends during testing.

## Assumptions

- The 2nd of the month at 9 AM UTC is an acceptable fixed anchor; no timezone-per-client adjustment is required for the send trigger.
- "Last month" reporting period resolution follows the same logic already implemented in the existing analytics report worker.
- The maximum deferral window of 7 days is sufficient — the longest possible streak of consecutive non-business days in the US calendar (e.g., a holiday on Friday + weekend) is 3 days; 7 days is a conservative safety cap.
- Client recipients, GA4 configuration, email rendering, and notification logging are fully handled by the existing analytics report worker; the scheduler's sole responsibility is date enforcement and event fan-out.
- Columbus Day is included in the holiday set despite some organisations not observing it; this can be adjusted post-implementation if needed.
