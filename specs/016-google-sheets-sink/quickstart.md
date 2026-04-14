# Quickstart: Google Sheets Sink (Local Testing)

## Prerequisites

- `npm run dev` running (app server + Inngest Dev Server)
- A test client record in the database (run `npm run db:seed` if not already done)
- A Google Sheet you own with a service account that has Editor access (or use mock mode — no sheet needed)

---

## Option A: Test Without a Real Sheet (Mock Mode)

In `mock` email mode (the default for local dev), Sheets writes are automatically skipped. You can still verify the workflow runs correctly end-to-end:

1. Ensure `EMAIL_MODE=mock` in your `.env.local` (this is the default).
2. Fire a `form/submitted` event with a `sheetsDestination` via the Inngest Dev UI at `http://localhost:8288`.
3. In the Dev UI, confirm the `sync-to-google-sheets` step ran and logged `"skipped (non-live mode)"`.
4. Confirm the email step still completed (check `.email-preview/last.html`).

No credentials or real sheet needed.

---

## Option B: Test With a Real Sheet (Live Mode)

### Step 1 — Set up a service account (one-time)

Follow the onboarding steps in the spec:
1. Create a GCP service account and download the JSON key.
2. Share a Google Sheet with the service account email (Editor access).
3. Enable the Google Sheets API in your GCP project.

### Step 2 — Seed credentials into a test client record

```sql
UPDATE clients
SET
  google_service_account_email = 'your-sa@your-project.iam.gserviceaccount.com',
  google_service_account_key   = '{ ...full JSON key contents... }'
WHERE id = 'your-test-client-id';
```

Or add these fields directly in `scripts/seed-data.ts` for your local test client.

### Step 3 — Set `EMAIL_MODE=live` temporarily

In `.env.local`:
```
EMAIL_MODE=live
```

> **Warning**: With `live` mode, the email step will attempt real delivery. Either point your test client's email to an address you control, or restore `mock` mode after testing Sheets.

### Step 4 — Fire a test event

Via the Inngest Dev UI (`http://localhost:8288`), send a `form/submitted` event:

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "your-test-client-id",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com",
    "submitterMessage": "Hello from the local dev test",
    "formName": "Contact Us",
    "sheetsDestination": {
      "spreadsheetId": "YOUR_SPREADSHEET_ID_HERE",
      "sheetName": "testing",
      "columns": ["_timestamp", "submitterName", "submitterEmail", "submitterMessage"]
    }
  }
}
```

### Step 5 — Verify

1. Open your Google Sheet — a new row should appear with the mapped values.
2. Check the Inngest Dev UI — `sync-to-google-sheets` step should show `{ success: true }`.
3. Check the notification log in the database for the `sheets_outcome` metadata field.

---

## Testing the GA4 Migration

The analytics report now reads credentials from the client record instead of `GA4_SERVICE_ACCOUNT_JSON`.

1. Remove (or leave unset) `GA4_SERVICE_ACCOUNT_JSON` from `.env.local`.
2. Ensure the test client has `google_service_account_key` set (same key from above if it has GA4 access) and a valid `ga4_property_id`.
3. Trigger the analytics scheduler via the Inngest Dev UI (`analytics/report.requested` event).
4. Confirm the report generates with live data (not mock) for the client with credentials, and mock data for clients without.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Step skipped, logs "non-live mode" | `EMAIL_MODE` is not `live` — expected in dev |
| Step fails with 403 | Sheet not shared with service account email, or Sheets API not enabled |
| Step fails with 404 | `spreadsheetId` is wrong or sheet was deleted |
| Step fails with "invalid_grant" | Service account key is expired or malformed |
| GA4 report returns mock data | `google_service_account_key` not set on client record, or `ga4_property_id` missing |
