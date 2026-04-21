# Event Contracts: Monthly Analytics Scheduler

**Feature**: 021-monthly-analytics-scheduler  
**Date**: 2026-04-17

---

## Consumed Events (inputs)

### `analytics/monthly.scheduled`

Manual trigger. Fires the scheduler immediately, applying the same business-day enforcement as the automated cron.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| *(none)* | — | — | Payload is an empty object |

**Example**:
```json
{
  "name": "analytics/monthly.scheduled",
  "data": {}
}
```

---

## Produced Events (outputs)

### `analytics/report.requested`

One event dispatched per active client when a valid US business day is confirmed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | `string` | Yes | Client identifier from the `clients` table |
| `reportPeriod.preset` | `"last_month"` | Yes | Always `"last_month"` for the monthly scheduler |
| `scheduledAt` | `string` | Yes | ISO 8601 timestamp of the resolved valid business day at 9:00:00 UTC |

**Example**:
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "acme-corp",
    "reportPeriod": { "preset": "last_month" },
    "scheduledAt": "2026-04-06T09:00:00.000Z"
  }
}
```

**Note**: This event is handled by the existing `send-analytics-report` Inngest function (`src/inngest/functions/analytics-report.ts`). No changes to that function are required.

---

## Cron Trigger

| Property | Value |
|----------|-------|
| Schedule | `0 9 2 * *` |
| Meaning | 2nd of every month at 09:00 UTC |
| Function ID | `monthly-analytics-scheduler` |
