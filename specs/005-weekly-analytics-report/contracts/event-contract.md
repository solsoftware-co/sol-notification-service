# Event Contract: Weekly Analytics Report (005)

**Branch**: `005-weekly-analytics-report`
**Date**: 2026-02-28 (revised)

This document defines the two Inngest events introduced by this feature. Any external system or developer triggering these events must conform to these contracts.

---

## Event 1: `analytics/weekly.scheduled`

**Purpose**: Manual trigger for the weekly analytics scheduler. Used from the Inngest Dev UI to test the full fan-out without waiting for the Tuesday cron window.

**Trigger**: Manual (Dev UI or `inngest.send()` from a script). Also fired automatically by the cron on `0 9 * * 2` (Tuesday 09:00 UTC).

**Payload**: Empty data object — no fields required.

```json
{
  "name": "analytics/weekly.scheduled",
  "data": {}
}
```

**Consumed by**: `weekly-analytics-scheduler` function

**Notes**:
- The scheduler function listens to BOTH this event and the cron trigger
- Sending this event in non-production will apply the test-client filter and 1-client limit automatically
- The scheduler always uses `reportPeriod: { preset: "last_week" }` — to test other presets, send `analytics/report.requested` directly (see Event 2)
- No authentication required beyond access to the Inngest Dev UI or API key

---

## Event 2: `analytics/report.requested`

**Purpose**: Per-client trigger for the analytics report workflow. Dispatched by the scheduler — one event per active client per scheduled run. Can also be sent manually to trigger a single-client report with any period preset.

**Trigger**: Internal (dispatched by `weekly-analytics-scheduler` via `step.sendEvent()`) or manual (Dev UI for testing individual clients or non-default periods).

**Payload**:

```typescript
{
  name: "analytics/report.requested",
  data: {
    clientId: string;          // REQUIRED. Must match a row in the clients table.
    reportPeriod: {
      preset: ReportPeriodPreset;  // REQUIRED. One of the values below.
      start?: string;              // ISO 8601 date — only required when preset === "custom"
      end?: string;                // ISO 8601 date — only required when preset === "custom"
    };
    scheduledAt: string;       // REQUIRED. ISO 8601 timestamp. Used for preset resolution.
  }
}
```

### `ReportPeriodPreset` values

| Preset | Date range resolved | Typical use |
|--------|-------------------|-------------|
| `"last_week"` | Monday 8 days before `scheduledAt` → Sunday 2 days before `scheduledAt` | Default for Tuesday cron |
| `"last_month"` | First day of previous calendar month → Last day of previous calendar month | Monthly summary |
| `"last_30_days"` | Yesterday – 29 days → Yesterday | Rolling 30-day window |
| `"last_90_days"` | Yesterday – 89 days → Yesterday | Quarterly view |
| `"custom"` | `reportPeriod.start` → `reportPeriod.end` (verbatim) | Ad-hoc date range |

### Examples

**Default weekly (sent by scheduler):**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "client_abc123",
    "reportPeriod": { "preset": "last_week" },
    "scheduledAt": "2026-02-24T09:00:00.000Z"
  }
}
```

**Last month:**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "client_abc123",
    "reportPeriod": { "preset": "last_month" },
    "scheduledAt": "2026-02-28T10:00:00.000Z"
  }
}
```

**Custom range:**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "client_abc123",
    "reportPeriod": {
      "preset": "custom",
      "start": "2026-01-01",
      "end": "2026-01-31"
    },
    "scheduledAt": "2026-02-28T10:00:00.000Z"
  }
}
```

**Consumed by**: `send-weekly-analytics-report` function

**Validation rules** (enforced inside the workflow, not at event ingestion):
- `clientId` must be present and non-empty — missing field throws immediately
- `reportPeriod.preset` must be one of the five valid values — unknown preset throws in the resolve step
- When `preset === "custom"`: both `reportPeriod.start` and `reportPeriod.end` must be present — missing either throws in the resolve step
- The referenced client must be active and have `ga4_property_id` set — missing property fails the validate step

**Error behaviour**:
- Missing `clientId` → immediate failure, no email sent, no GA4 call made
- Unknown or invalid preset → `resolve-report-period` step throws, run marked failed
- Custom preset missing start/end → `resolve-report-period` step throws, run marked failed
- Client not found or inactive → `fetch-client-config` step throws, run marked failed
- Missing `ga4_property_id` → `validate-ga4-config` step throws "GA4 property not configured: {clientId}", run marked failed
- GA4 API error → `fetch-analytics-data` step retries up to 3 times, then run marked failed
- Email delivery error → `send-email` step retries up to 3 times, then run marked failed

---

## Naming Convention

Both event names follow the `domain/action` convention established in the constitution:

| Event | Domain | Action |
|-------|--------|--------|
| `analytics/weekly.scheduled` | `analytics` | `weekly.scheduled` |
| `analytics/report.requested` | `analytics` | `report.requested` |
