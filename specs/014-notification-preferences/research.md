# Research: Per-Client Notification Preferences

## Decision 1: Storage location for notification preferences

**Decision**: Use the existing `clients.settings JSONB` column. Store preferences under the key `notifications`, mapping workflow type keys to arrays of recipient email strings.

```json
{
  "notifications": {
    "form_submitted": ["sales@example.com", "owner@example.com"],
    "analytics_report": ["marketing@example.com"]
  }
}
```

**Rationale**: The `settings` column already exists and is typed as `Record<string, unknown>` in `ClientRow`. No migration is needed. New workflow types are added by convention (new key), not by schema change.

**Alternatives considered**:
- New `notification_recipients` table — rejected; adds schema complexity and a migration for a problem JSONB solves cleanly.
- Separate `emails` array column on `clients` — rejected; doesn't support per-workflow-type recipient lists.

---

## Decision 2: Recipient resolution helper location

**Decision**: New file `src/lib/notifications.ts` exporting a single pure function `resolveRecipients(client: ClientRow, workflowKey: string): string[]`.

**Rationale**: Keeps the fallback logic in one place. Both `form-notification.ts` and `weekly-analytics-report.ts` import from it. Future workflows do the same. Consistent with the `src/lib/` pattern for shared utilities.

**Alternatives considered**:
- Inline the logic in each workflow — rejected; duplicates the fallback and validation logic.
- Add to `src/lib/db.ts` — rejected; `db.ts` is for data access, not business logic.

---

## Decision 3: Multi-recipient support in `email.ts`

**Decision**: Extend `EmailRequest.to` from `string` to `string | string[]`. Update `EmailResult.originalTo` to match. Update `validateRecipient` to accept and validate arrays. Resend's SDK already accepts `to: string | string[]` natively.

**Test mode behaviour**: When `EMAIL_MODE=test`, all recipients are redirected to `config.testEmail`. The subject prefix becomes `[TEST: addr1, addr2] Subject` listing the original addresses.

**Mock mode behaviour**: Log all recipient addresses joined with `, `.

**Rationale**: The Resend SDK `emails.send()` method already accepts `to` as `string | string[]`. Extending the internal type keeps the abstraction consistent with what the underlying provider supports.

**Alternatives considered**:
- One `sendEmail()` call per recipient — rejected; creates N separate email threads for what should be a single message; also multiplies Resend API calls unnecessarily.

---

## Decision 4: Handling of invalid addresses within a list

**Decision**: `resolveRecipients` performs basic validation (non-empty, contains `@`) on each address. Invalid addresses are filtered out with a `logError` warning per address. If the filtered list is empty, fall back to `client.email`. The primary email is not validated by the resolver (it is already validated by `email.ts` at send time).

**Rationale**: Consistent with the existing `validateRecipient` check in `email.ts`. Keeps recipient resolution safe without throwing on partial data.

---

## Decision 5: No new packages required

**Decision**: Zero new dependencies. All changes use TypeScript, existing types, and the existing Resend SDK which already supports multi-recipient sends.

**Rationale**: Satisfies Constitution Principle VI (minimal infrastructure). Resend's `to: string[]` support is documented and available in `resend ^3.x`.

---

## Decision 6: `NotificationLogEntry.recipient_email` field

**Decision**: When multiple recipients are used, join them as a comma-separated string for logging (e.g. `"a@x.com, b@x.com"`). The DB column is `TEXT` — no schema change needed.

**Rationale**: Keeps the DB schema unchanged while preserving full recipient visibility in logs. A future migration could normalise this if querying per-recipient becomes necessary.
