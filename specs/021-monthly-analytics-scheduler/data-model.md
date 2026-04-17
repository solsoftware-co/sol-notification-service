# Data Model: Monthly Analytics Scheduler

**Feature**: 021-monthly-analytics-scheduler  
**Date**: 2026-04-17

## Database Changes

**None.** This feature introduces no new tables, columns, or migrations. The scheduler reads active clients via the existing `getAllActiveClients()` helper and dispatches Inngest events. All state is managed by Inngest's durable execution engine.

---

## New Types (`src/types/index.ts`)

### `MonthlyScheduledPayload`

Manual trigger event payload for `analytics/monthly.scheduled`. No required fields — the scheduler derives its anchor date from wall-clock time at invocation.

```
MonthlyScheduledPayload
  (empty object — no required fields)
```

This mirrors the implicit contract of `analytics/weekly.scheduled`, which also carries an empty payload `{}`.

---

## Existing Types (unchanged, referenced for context)

### `AnalyticsReportRequestedPayload`

The scheduler dispatches this event for each active client. The monthly scheduler sets:
- `reportPeriod.preset` = `"last_month"`
- `scheduledAt` = the resolved valid business day (ISO 8601 string)
- `clientId` = from the `ClientRow`

No changes to this type are required.

### `ClientRow`

Read via `getAllActiveClients()`. No changes required.

---

## Runtime State (Inngest-managed)

The scheduler function manages transient state across sleep/resume cycles via Inngest's step cache:

| Cached Step | Value stored | Purpose |
|-------------|-------------|---------|
| `capture-trigger-date` | ISO 8601 string (9 AM UTC on trigger date) | Anchor for all candidate date calculations; deterministic across replays |
| `check-business-day-N` | `boolean` | Whether candidate day N was a valid US business day |

No persistent state is written to the database by the scheduler itself. The dispatched `analytics/report.requested` events produce `notification_logs` rows via the existing `analytics-report` worker.
