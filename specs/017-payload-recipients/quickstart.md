# Quickstart: Per-Invocation Recipient Override (Local Testing)

## Prerequisites

- `npm run dev` running (app server + Inngest Dev Server)
- A test client record in the database (run `npm run db:seed` if not already done)

---

## Option A: Payload Recipients Used (Override Mode)

Fire a `form/submitted` event with a `recipients` field via the Inngest Dev UI at `http://localhost:8288`:

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com",
    "submitterMessage": "Testing recipient override",
    "formName": "Contact Us",
    "recipients": ["alice@example.com", "bob@example.com"]
  }
}
```

**Expected behaviour (mock mode)**:
1. `send-email` step runs — logs delivery to `alice@example.com, bob@example.com`
2. `.email-preview/last.html` is written with the rendered email
3. `log-result` step records `recipient_source: "payload"` in metadata (if `EMAIL_MODE=live`)

---

## Option B: Fallback to Settings List

Ensure your test client has `settings.notifications.form_submitted` configured:

```sql
UPDATE clients
SET settings = jsonb_set(
  settings,
  '{notifications,form_submitted}',
  '["team@example.com", "manager@example.com"]'
)
WHERE id = 'your-test-client-id';
```

Fire a `form/submitted` event **without** a `recipients` field:

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com",
    "submitterMessage": "Testing settings fallback"
  }
}
```

**Expected behaviour**: email delivered to `team@example.com` and `manager@example.com`; `recipient_source: "settings"` logged.

---

## Option C: Fallback to client.email

Ensure no `settings.notifications.form_submitted` is configured for your test client and omit `recipients` from the payload.

**Expected behaviour**: email delivered to `client.email`; `recipient_source: "client_email"` logged.

---

## Option D: Invalid Addresses Gracefully Discarded

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com",
    "submitterMessage": "Testing invalid address handling",
    "recipients": ["valid@example.com", "not-an-email", ""]
  }
}
```

**Expected behaviour**: email delivered to `valid@example.com` only; warnings logged for `not-an-email` and `""`.

---

## Option E: All Invalid → Fallback

```json
{
  "recipients": ["not-an-email", "also-bad"]
}
```

**Expected behaviour**: system falls back to settings or `client.email`; notification log records the fallback reason.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Email still going to `client.email` despite `recipients` in payload | `recipients` array contained only invalid addresses — check Inngest step logs for validation warnings |
| `recipient_source` not in notification log | `EMAIL_MODE` is not `live` — log entry is only written in live mode |
| `recipients` field ignored entirely | Check that `FormSubmittedPayload` type was updated and TypeScript compiled correctly |
