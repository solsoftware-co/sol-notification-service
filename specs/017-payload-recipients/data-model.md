# Data Model: Per-Invocation Recipient Override

**Feature**: 017-payload-recipients  
**Date**: 2026-04-13

---

## No Database Schema Changes

This feature requires no new tables, columns, or migrations. All data lives in the event payload (transient) or in existing JSONB `metadata` fields (notification log).

---

## Modified Types

### `FormSubmittedPayload` (extended)

```
FormSubmittedPayload
├── clientId: string                          (required, existing)
├── submitterName?: string                    (existing)
├── submitterEmail?: string                   (existing)
├── submitterMessage?: string                 (existing)
├── submitterPhone?: string                   (existing)
├── submittedFrom?: string                    (existing)
├── formName?: string                         (existing)
├── customFields?: Record<string, string>     (existing)
├── sheetsDestination?: GoogleSheetsDestination  (existing, from 016)
└── recipients?: string[]                     ← NEW — optional per-invocation recipient list
```

**Validation rules for `recipients`**:
- Optional — omitting it preserves existing behaviour exactly
- `null` and `[]` (empty array) are treated identically to omitted
- Whitespace-only strings are trimmed and treated as invalid
- Invalid entries (fail email format check) are discarded; logged in notification metadata
- Duplicates (case-insensitive) are collapsed to the first occurrence

---

### `RecipientResolutionResult` (new internal type)

Used as the return type of the updated `resolveRecipients` function.

```
RecipientResolutionResult
├── recipients: string[]     — final deduplicated list, always non-empty
└── source: "payload" | "settings" | "client_email"
```

**Source meanings**:
- `"payload"` — at least one valid address came from `event.data.recipients`
- `"settings"` — no valid payload recipients; resolved from `client.settings.notifications.form_submitted`
- `"client_email"` — neither payload nor settings produced a valid list; used `client.email`

---

## Notification Log Metadata (extended)

The `metadata` JSONB column in `notification_logs` will now include:

```json
{
  "formData": { "...existing fields..." },
  "sheets_outcome": { "...existing..." },
  "recipient_source": "payload" | "settings" | "client_email"
}
```

No migration needed — `metadata` is a schemaless JSONB column.
