# Contract: resolveRecipients

**Module**: `src/lib/notifications.ts`  
**Type**: Internal library function contract

---

## Signature

```typescript
function resolveRecipients(
  client: ClientRow,
  workflowKey: string,
  payloadRecipients?: string[] | null
): { recipients: string[]; source: "payload" | "settings" | "client_email" }
```

---

## Resolution Algorithm

```
1. If payloadRecipients is a non-empty array:
   a. Trim and validate each entry (non-empty, contains "@")
   b. Discard invalid entries (log a warning per dropped address)
   c. Deduplicate case-insensitively (keep first occurrence)
   d. If at least one valid address remains → return { recipients: valid[], source: "payload" }

2. Read client.settings.notifications?.[workflowKey]:
   a. If it is a non-empty array:
      - Trim and validate each entry
      - Discard invalids (log warning)
      - Deduplicate case-insensitively
      - If at least one valid address remains → return { recipients: valid[], source: "settings" }

3. Fallback → return { recipients: [client.email], source: "client_email" }
```

---

## Invariants

- **Always returns non-empty `recipients`**: `client.email` is the unconditional final fallback; it is assumed valid (stored in DB with basic validation at onboarding).
- **Never throws**: All validation errors are logged as warnings, not exceptions.
- **Backwards compatible**: Callers that omit `payloadRecipients` observe identical resolution behaviour to the pre-017 function.

---

## Call Sites

| File | `workflowKey` | `payloadRecipients` |
|------|---------------|---------------------|
| `src/inngest/functions/form-notification.ts` | `"form_submitted"` | `data.recipients` |
| `src/inngest/functions/analytics-report.ts` | `"analytics_report"` | _(omitted — no payload override)_ |

---

## Event Payload Contract (updated)

`form/submitted` event — `data` object additions:

```typescript
interface FormSubmittedPayload extends BaseEventPayload {
  // ... existing fields unchanged ...

  /**
   * Optional per-invocation recipient override.
   * When present and valid, these addresses receive the notification
   * instead of the stored settings or client.email.
   * Invalid entries are discarded; empty array treated as absent.
   */
  recipients?: string[];
}
```

---

## Test Requirements

| Scenario | Expected `recipients` | Expected `source` |
|----------|-----------------------|-------------------|
| `payloadRecipients = ["a@b.com"]` | `["a@b.com"]` | `"payload"` |
| `payloadRecipients = ["a@b.com", "a@B.com"]` (dup) | `["a@b.com"]` | `"payload"` |
| `payloadRecipients = ["not-an-email"]` (all invalid) | settings or client.email | `"settings"` or `"client_email"` |
| `payloadRecipients = []` (empty) | settings or client.email | `"settings"` or `"client_email"` |
| `payloadRecipients = null` | settings or client.email | `"settings"` or `"client_email"` |
| No `payloadRecipients`, settings has list | settings list | `"settings"` |
| No `payloadRecipients`, no settings | `[client.email]` | `"client_email"` |
