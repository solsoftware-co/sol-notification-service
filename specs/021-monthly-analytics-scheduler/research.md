# Research: Monthly Analytics Scheduler

**Feature**: 021-monthly-analytics-scheduler  
**Date**: 2026-04-17

## Decision 1: Inngest Loop Pattern for Day-by-Day Retry

**Decision**: Use a bounded `for` loop (max 7 iterations) with `step.sleepUntil()` and deterministic indexed step IDs (`check-business-day-0`, `sleep-until-day-1`, etc.).

**Rationale**: Inngest replays the entire function from the top each time it resumes after a sleep. Previously-completed steps return their cached results instantly; the next un-executed step runs fresh. As long as step IDs are deterministic across replays (guaranteed by the loop index), this pattern is safe and idiomatic. The anchor date is captured in a single first step (`capture-trigger-date`) whose cached result ensures candidate dates remain deterministic on every replay — regardless of how many days have passed since the original trigger.

**Alternatives considered**:
- *Recursive Inngest events* (each day dispatches a "check again tomorrow" event): adds event fan-out complexity and loses execution continuity in the Inngest dashboard.
- *Cron-based daily check* (separate function): requires shared state between runs and can race with multiple monthly instances.
- *Single long sleep* (pre-compute the target date, sleep once): can't account for holidays and weekends in a single calculation without fully computing the target date upfront — workable but less transparent; the step-by-step approach makes each day's decision visible in the Inngest dashboard.

---

## Decision 2: US Federal Holiday Computation

**Decision**: Pure TypeScript function `getUSFederalHolidays(year)` returning a `Set<string>` of ISO date strings. Computed from first principles: fixed-date holidays with observed-date adjustment, plus floating holidays via nth-weekday-of-month formulas.

**Rationale**: Zero external dependencies; no network call required; fully deterministic and testable. The 11 US federal holidays have stable rules that change at most once per decade (Juneteenth was added in 2021).

**Holidays covered**:
| Holiday | Rule |
|---------|------|
| New Year's Day | Jan 1, observed |
| Martin Luther King Jr. Day | 3rd Monday of January |
| Presidents' Day | 3rd Monday of February |
| Memorial Day | Last Monday of May |
| Juneteenth | Jun 19, observed |
| Independence Day | Jul 4, observed |
| Labor Day | 1st Monday of September |
| Columbus Day | 2nd Monday of October |
| Veterans Day | Nov 11, observed |
| Thanksgiving Day | 4th Thursday of November |
| Christmas Day | Dec 25, observed |

**Observed-date rule**: If the fixed date falls on Saturday → observe Friday; if Sunday → observe Monday. Applied to New Year's Day, Juneteenth, Independence Day, Veterans Day, and Christmas Day.

**Alternatives considered**:
- *Third-party holiday library* (e.g., `date-holidays`): adds a dependency (~200 kB) for 11 rules that can be expressed in ~40 lines; rejected per Principle VI.
- *Static lookup table* (hard-coded per year): requires annual maintenance; rejected in favour of computed rules.

---

## Decision 3: Maximum Deferral Window

**Decision**: 7 days.

**Rationale**: The theoretical maximum consecutive non-business-day streak in the US calendar is 3 days (e.g., Christmas on Thursday → New Year's Day on Friday, but that requires two holidays in a row, which doesn't produce 3 consecutive non-business days by itself; the most realistic scenario is a Friday holiday + weekend = 3 days). A 7-day cap is a 2× safety margin over the worst realistic case. Beyond 7 days, the scheduler logs a skip and terminates — this situation is essentially impossible in practice.

---

## Decision 4: Trigger Date Anchor

**Decision**: Capture `new Date()` inside `step.run("capture-trigger-date")`, normalised to 9:00:00 UTC. Store as ISO string; all candidate dates computed as `anchor + i * 86400000 ms`.

**Rationale**: Inngest caches the return value of each completed step. On replay after a sleep, `capture-trigger-date` returns its original cached value — not the current wall-clock time. This means candidate dates are always computed relative to the original 2nd-of-month trigger, regardless of how many days have elapsed.

---

## Decision 5: No New Event Type for Dispatch

**Decision**: Reuse the existing `analytics/report.requested` event with `preset: "last_month"`. Add a new `analytics/monthly.scheduled` trigger event type (manual trigger only) typed as `MonthlyScheduledPayload` in `src/types/index.ts`.

**Rationale**: The `analytics-report` worker already handles `last_month` via `resolvePeriod()`. Creating a separate event for monthly vs. weekly reports would duplicate the worker and fragment the codebase. The only new type needed is the (empty-payload) manual trigger event, for consistency with how `analytics/weekly.scheduled` is handled.
