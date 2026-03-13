# Data Model: Notification Send Logging

**Feature**: 012-notification-logging
**Date**: 2026-03-11

## Migration: V002__add_notification_log_columns.sql

Adds columns to the existing `notification_logs` table. No table recreation, no data loss.

```sql
ALTER TABLE notification_logs
  ADD COLUMN recipient_email TEXT,
  ADD COLUMN subject         TEXT,
  ADD COLUMN resend_id       TEXT,
  ADD COLUMN error_message   TEXT,
  ADD COLUMN metadata        JSONB NOT NULL DEFAULT '{}';
```

`recipient_email` and `subject` are nullable to allow safe migration of any existing rows (none in practice, but the migration must be idempotent).

---

## Updated Table: notification_logs

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | BIGSERIAL | NO | Primary key |
| client_id | TEXT | NO | FK → clients(id) |
| workflow | TEXT | NO | e.g. `"send-analytics-report"` |
| event_name | TEXT | NO | e.g. `"analytics/report.requested"` |
| outcome | TEXT | NO | `"sent"` \| `"failed"` \| `"skipped"` |
| recipient_email | TEXT | YES | Actual recipient (may differ from client email in test mode) |
| subject | TEXT | YES | Email subject line |
| resend_id | TEXT | YES | Delivery provider ID; null for mock/test modes |
| error_message | TEXT | YES | Failure or skip reason; null on `"sent"` |
| metadata | JSONB | NO | Workflow inputs for local reproduction |
| created_at | TIMESTAMPTZ | NO | Default: NOW() |

---

## New Type: NotificationLogEntry (src/types/index.ts)

Input type for `writeNotificationLog()`. All fields map directly to table columns.

```typescript
export interface NotificationLogEntry {
  client_id: string;
  workflow: string;
  event_name: string;
  outcome: 'sent' | 'failed' | 'skipped';
  recipient_email: string;
  subject: string;
  resend_id?: string;        // undefined → stored as NULL
  error_message?: string;    // undefined → stored as NULL
  metadata: Record<string, unknown>;
}
```

Update `NotificationLogRow` (existing read-side type) to add the new columns:

```typescript
export interface NotificationLogRow {
  id: number;
  client_id: string;
  workflow: string;
  event_name: string;
  outcome: 'sent' | 'failed' | 'skipped';   // was "success" — corrected
  recipient_email: string | null;
  subject: string | null;
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}
```

---

## New Function: writeNotificationLog (src/lib/db.ts)

```typescript
export async function writeNotificationLog(entry: NotificationLogEntry): Promise<void> {
  await query(
    `INSERT INTO notification_logs
       (client_id, workflow, event_name, outcome,
        recipient_email, subject, resend_id, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.client_id,
      entry.workflow,
      entry.event_name,
      entry.outcome,
      entry.recipient_email,
      entry.subject,
      entry.resend_id ?? null,
      entry.error_message ?? null,
      JSON.stringify(entry.metadata),
    ]
  );
}
```

---

## metadata Payloads by Workflow

### analytics-report (send-analytics-report)

Available from prior steps in the `"log-result"` step:

| Field | Source |
|-------|--------|
| `ga4_property_id` | `client.ga4PropertyId` (from fetch-client-config step) |
| `period_preset` | `data.reportPeriod.preset` (from event payload) |
| `date_range_start` | `resolvedPeriod.startDate` (from resolve-report-period step) |
| `date_range_end` | `resolvedPeriod.endDate` (from resolve-report-period step) |

### form-notification (send-form-notification)

| Field | Source |
|-------|--------|
| `formData` | `event.data` (original event payload, minus clientId) |
