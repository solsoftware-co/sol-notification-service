# Quickstart: Form Notification Payload Controls (Local Testing)

## Prerequisites

- `npm run dev` running (app server + Inngest Dev Server)
- A test client record in the database (`npm run db:seed` if not already done)

---

## Option A: Skip Email (sendEmail: false)

Fire a `form/submitted` event via the Inngest Dev UI at `http://localhost:8288`:

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com",
    "submitterMessage": "Just collecting to a sheet, no email needed",
    "sendEmail": false,
    "sheetsDestination": {
      "spreadsheetId": "YOUR_SPREADSHEET_ID",
      "sheetName": "testing",
      "columns": ["_timestamp", "submitterName", "submitterEmail", "submitterMessage"]
    }
  }
}
```

**Expected behaviour**:
1. `send-email` step returns `{ skipped: true, reason: "sendEmail=false" }` — no email sent
2. `sync-to-google-sheets` step still runs and appends the row (in live mode)
3. `.email-preview/last.html` is NOT written or updated

---

## Option B: Default (sendEmail omitted)

Omit `sendEmail` entirely — email sends as normal, confirming backwards compatibility.

---

## Option C: URL CTA Button

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "submitterMessage": "I am interested",
    "ctaButton": {
      "text": "View in CRM",
      "action": {
        "type": "url",
        "url": "https://crm.example.com/leads/jane-smith"
      }
    }
  }
}
```

**Expected behaviour**: Email renders with a "View in CRM" button linking to the CRM URL. Open `.email-preview/last.html` to verify the button href and label.

---

## Option D: Custom Mailto CTA

```json
{
  "ctaButton": {
    "text": "Contact Sales",
    "action": {
      "type": "mailto",
      "email": "sales@mycompany.com"
    }
  }
}
```

**Expected behaviour**: Button labelled "Contact Sales" opens `mailto:sales@mycompany.com`.

---

## Option E: Custom Text, Default Action

```json
{
  "ctaButton": {
    "text": "Get Back to Jane"
  }
}
```

**Expected behaviour**: Button labelled "Get Back to Jane" with the default `mailto:jane@example.com` action (uses `submitterEmail`).

---

## Option F: Invalid URL Falls Back Silently

```json
{
  "ctaButton": {
    "text": "Broken",
    "action": {
      "type": "url",
      "url": "not-a-url"
    }
  }
}
```

**Expected behaviour**: Warning logged; button falls back to default `mailto:submitterEmail` with the default label — "Broken" text is discarded because the URL was invalid.

---

## Option G: sendEmail=false + Custom CTA (controls are independent)

```json
{
  "sendEmail": false,
  "ctaButton": {
    "text": "Ignored anyway",
    "action": { "type": "url", "url": "https://example.com" }
  }
}
```

**Expected behaviour**: No email sent. CTA config is irrelevant since the email is skipped.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Email still sent despite `sendEmail: false` | Check the payload — `sendEmail` must be the boolean `false`, not the string `"false"` |
| CTA button shows default text/link despite `ctaButton` in payload | `ctaButton.action.url` is invalid or missing — check Inngest step logs for a warning |
| No CTA button rendered at all | Neither `submitterEmail` nor a valid `ctaButton` action was provided |
| Button href shows `mailto:` despite `type: "url"` | URL validation failed (missing protocol, empty string) — silent fallback to mailto |
