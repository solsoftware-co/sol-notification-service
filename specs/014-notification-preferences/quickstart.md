# Quickstart: Per-Client Notification Preferences

## What this feature does

Allows each client to configure per-workflow recipient lists stored in their `settings` JSONB column. If no list is configured (or it is empty), the workflow falls back to `client.email`.

---

## Configuring a client

Update the client's `settings` column directly in the database:

```sql
UPDATE clients
SET settings = jsonb_set(
  settings,
  '{notifications}',
  '{"form_submitted": ["sales@example.com", "owner@example.com"], "analytics_report": ["marketing@example.com"]}'::jsonb
)
WHERE id = '<client_id>';
```

To add only form notification recipients without touching other settings keys:

```sql
UPDATE clients
SET settings = jsonb_set(
  settings,
  '{notifications, form_submitted}',
  '["sales@example.com"]'::jsonb,
  true   -- create key if absent
)
WHERE id = '<client_id>';
```

---

## Testing locally (mock mode)

With `EMAIL_MODE=mock`, no real emails are sent. The resolved recipient list is logged to stdout.

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Update a seeded client's settings (see SQL above).

3. Send a `form/submitted` event via the Inngest Dev UI at `http://localhost:8288`:

   ```json
   {
     "name": "form/submitted",
     "data": {
       "clientId": "client-acme",
       "submitterName": "Jane Doe",
       "submitterEmail": "jane@example.com",
       "submitterMessage": "Hello!"
     }
   }
   ```

4. Check the terminal — you should see the resolved recipient list logged in the `send-email` step.

---

## Testing with the analytics report

Send an `analytics/report.requested` event:

```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "client-acme",
    "reportPeriod": { "preset": "last_month" },
    "scheduledAt": "2026-04-09T10:00:00.000Z"
  }
}
```

---

## Fallback behaviour

| Client settings state | Result |
|-----------------------|--------|
| `notifications` key absent | Falls back to `client.email` |
| `notifications.form_submitted` absent | Falls back to `client.email` |
| `notifications.form_submitted = []` | Falls back to `client.email` |
| All addresses invalid | Falls back to `client.email` (warnings logged) |
| Valid addresses present | Sends to those addresses only |

---

## Adding a new workflow type

To make a new workflow respect preferences, call `resolveRecipients` in its `send-email` step:

```ts
import { resolveRecipients } from "../../lib/notifications";

// Inside step.run("send-email", async () => {
const recipients = resolveRecipients(client, "your_workflow_key");
return sendEmail({ to: recipients, subject, html, attachments });
```

No data model changes required.
