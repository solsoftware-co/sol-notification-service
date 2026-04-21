# Event Contracts: Per-Client Timezone

**Feature**: 022-client-timezone  
**Date**: 2026-04-20

---

## No Event Schema Changes

The event payloads for `analytics/report.requested`, `analytics/weekly.scheduled`, and `analytics/monthly.scheduled` are **unchanged**. Timezone is an internal concern — it is read from the client record at workflow execution time, not passed through events.

---

## Cron Schedule Changes

| Function | Old Cron | New Cron | Change |
|----------|----------|----------|--------|
| `weekly-analytics-scheduler` | `0 9 * * 2` (Tue 9 AM UTC) | `0 0 * * 2` (Tue midnight UTC) | Shifted to midnight so all US 9 AMs are in the future |
| `monthly-analytics-scheduler` | `0 9 2 * *` (2nd 9 AM UTC) | `0 0 2 * *` (2nd midnight UTC) | Shifted to midnight so all US 9 AMs are in the future |

---

## Worker Step Changes (analytics-report)

Two new steps are inserted after `fetch-client-config`:

### `resolve-send-time`

Computes the UTC timestamp for the next valid 9 AM business day in the client's timezone. Returns an ISO string.

**Logic**:
1. Start from `scheduledAt` (the event's trigger time)
2. For each candidate day (up to 7):
   - Compute 9 AM in `client.timezone` on that day
   - Check if that day is a non-holiday weekday in `client.timezone`
   - If yes → return that UTC timestamp
   - If no → advance by 24 hours
3. If no valid day found in 7 iterations → return `scheduledAt` (send immediately, log warning)

### `wait-for-send-window`

`step.sleepUntil` targeting the UTC timestamp returned by `resolve-send-time`. The worker is suspended until that moment.

**Step order after this change**:
1. `validate-payload`
2. `fetch-client-config`
3. `resolve-send-time` ← new
4. `wait-for-send-window` ← new
5. `check-ga4-config`
6. `resolve-report-period`
7. `fetch-analytics-data`
8. `send-email`
9. `log-result`
