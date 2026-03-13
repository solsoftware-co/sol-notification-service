# Research: Notification Send Logging

**Feature**: 012-notification-logging
**Date**: 2026-03-11

## Decision 1: Log Write Step Placement

**Decision**: Modify the existing `"log-result"` step in each workflow rather than adding a new dedicated step.

**Rationale**: Both `form-notification.ts` and `analytics-report.ts` already have a `"log-result"` step as their final step. This step runs after `"send-email"` has already been committed by Inngest. Adding the DB write inside the existing step means:
- FR-008 is satisfied automatically — if `log-result` fails and retries, Inngest will NOT re-run `send-email` (prior steps are cached)
- No structural change to the function step chain
- The step already has access to all needed values: `clientId`, `result` (EmailResult), and workflow-specific inputs

**Alternatives considered**:
- Add a new `"write-notification-log"` step after `"log-result"`: Unnecessary extra step; the log-result step is the natural place for this.
- Write inside the `"send-email"` step: Would violate FR-008 — a log write failure would retry the email send.

---

## Decision 2: DB Function Signature

**Decision**: Add `writeNotificationLog(entry: NotificationLogEntry): Promise<void>` to `src/lib/db.ts`, using the existing `query<T>()` wrapper.

**Rationale**: All database access in this project routes through `src/lib/db.ts` and uses the `query<T>()` abstraction. Adding `writeNotificationLog()` follows the same pattern as `getClientById()` and `getAllActiveClients()`. The function takes a typed input, executes a single INSERT, and returns void.

**Alternatives considered**:
- Inline the INSERT query in each workflow function: Violates the constitution's rule that all DB queries route through `src/lib/db.ts`.
- Use a generic `insertRow()` helper: Over-engineered for one use case.

---

## Decision 3: outcome Values

**Decision**: Use `"sent" | "failed" | "skipped"` in `NotificationLogEntry`. Update `NotificationLogRow` to match.

**Rationale**: The spec defines these three values. The existing `NotificationLogRow` type uses `"success"` which conflicts with the spec and the `EmailResult.outcome` field which uses `"sent"`. Since no code currently reads `NotificationLogRow.outcome` (no log reads are implemented), this is a safe correction.

**Alternatives considered**:
- Keep `"success"` for backwards compatibility: No backwards compatibility concern — nothing reads this field today.

---

## Decision 4: metadata Shape per Workflow

**Decision**: Each workflow determines its own `metadata` content. No shared schema enforced at the DB layer — JSONB is flexible by design.

**Analytics report metadata**:
```json
{
  "ga4_property_id": "...",
  "period_preset": "last_week",
  "date_range_start": "2026-03-03",
  "date_range_end": "2026-03-09"
}
```
All values are available from prior steps: `client.ga4PropertyId`, `data.reportPeriod.preset`, `resolvedPeriod.startDate`, `resolvedPeriod.endDate`.

**Form notification metadata**:
```json
{
  "formData": { ... }
}
```
The original form submission payload from `event.data`.

**Rationale**: JSONB gives flexibility to add workflow-specific fields without schema migrations. The fields documented above satisfy FR-006 and FR-007.

---

## Decision 5: Log Writes Are Live-Mode Only

**Decision**: The DB write inside `"log-result"` is guarded by `config.emailMode === 'live'`. No rows are written in development (`mock`) or preview (`test`) environments.

**Rationale**: The audit log is a production concern. Dev and preview sends are not real client emails — writing them pollutes the DB with noise and inflates row counts without providing value. The e2e tests in preview validate email delivery via Mailtrap interception; they do not query `notification_logs`.

**Testing strategy**: The `writeNotificationLog()` function is tested directly in `db.test.ts` with a mocked DB pool, confirming insert correctness without requiring a live environment. Inngest function tests assert the function is called when `emailMode === 'live'` and skipped otherwise — covering both branches.

**Alternatives considered**:
- Log in all modes: Adds noise to dev/preview DBs with no operational value.
- Log in preview only (not dev): Preview rows still provide no value since e2e tests don't read them.

---

## Decision 6: No New Packages Required

**Decision**: Zero new dependencies.

**Rationale**: The migration adds columns to an existing table. The DB write uses the existing `@neondatabase/serverless` pool. No new infrastructure, no new packages. Fully compliant with Constitution Principle VI.

---

## Decision 6: resend_id on non-live Modes

**Decision**: `resend_id` is null for mock and test email modes. The INSERT must handle optional null values.

**Rationale**: `EmailResult.resendId` is typed as `string | undefined`. Mock mode returns no resend ID. The column must be nullable; the INSERT sets it to `resendId ?? null`.
