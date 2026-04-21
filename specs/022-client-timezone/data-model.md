# Data Model: Per-Client Timezone

**Feature**: 022-client-timezone  
**Date**: 2026-04-20

---

## Database Changes

### Migration: V004__add_client_timezone.sql

Adds `timezone` column to the existing `clients` table.

```sql
ALTER TABLE clients
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Chicago';
```

**Default**: `America/Chicago` — Central Time. Chosen because the prior fixed send time of 2 PM UTC approximated 8 AM CT, making CT the closest match to existing client experience.

**No index required**: The column is read once per workflow execution alongside other client config fields; no query filters or sorts on this column.

---

## Updated Types (`src/types/index.ts`)

### `SUPPORTED_TIMEZONES` (new const)

```
SUPPORTED_TIMEZONES = [
  "America/New_York",    // Eastern Time (EST/EDT)
  "America/Chicago",     // Central Time (CST/CDT) — default
  "America/Denver",      // Mountain Time (MST/MDT)
  "America/Los_Angeles", // Pacific Time (PST/PDT)
] as const
```

### `SupportedTimezone` (new type)

Derived from `SUPPORTED_TIMEZONES`: `"America/New_York" | "America/Chicago" | "America/Denver" | "America/Los_Angeles"`

### `ClientRow` (updated)

Add one field:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `timezone` | `SupportedTimezone` | No | `"America/Chicago"` | IANA timezone name for 9 AM local delivery |

---

## New Utility Exports (`src/utils/timezone.ts`)

### `localDateStr(tz, date?): string`

Returns the local date in `YYYY-MM-DD` format for the given timezone. Uses `Intl.DateTimeFormat` with `en-CA` locale (produces ISO date strings). Defaults `date` to `new Date()`.

### `next9amInTimezone(tz, from?): Date`

Returns a UTC `Date` representing the next occurrence of 09:00:00 in the given timezone on or after `from`. If `from` is already past 9 AM local time, returns 9 AM the following calendar day. Whole-hour US offsets mean the result is always exactly 09:00:00.000 local.

### `isNonHolidayWeekdayInTz(date, tz): boolean`

Returns `true` if `date` falls on a US non-holiday weekday when interpreted in the given timezone. Converts `date` to the local date string, then delegates to `isNonHolidayWeekday()` from `business-days.ts`.

---

## Workflow State Changes

### `analytics-report` worker — new steps inserted after `fetch-client-config`

| Step ID | Type | Description |
|---------|------|-------------|
| `resolve-send-time` | `step.run` | Computes the target send time: iterates up to 7 days from `scheduledAt`, finds first 9 AM in `client.timezone` that falls on a non-holiday weekday |
| `wait-for-send-window` | `step.sleepUntil` | Suspends worker until the resolved send time; Inngest re-invokes at that UTC moment |

### `monthly-analytics-scheduler` — steps removed

The following steps are removed (business-day logic moves to the worker):

| Removed Step | Reason |
|---|---|
| `capture-trigger-date` | No longer needed — scheduler fans out immediately |
| `check-business-day-N` (×7) | Moved to worker |
| `sleep-until-day-N` (×6) | Moved to worker |

The scheduler simplifies to: `fetch-active-clients` → `fan-out-report-events`.
