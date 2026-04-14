# Contract: `form/submitted` Event Payload

**Event name**: `form/submitted`  
**Handler**: `send-form-notification` Inngest function  
**Changed in**: feature `016-google-sheets-sink`

## Overview

The `form/submitted` event is triggered by calling applications (websites, forms) to fire the notification workflow. This feature adds one optional field — `sheetsDestination` — to the existing payload. All existing fields remain unchanged; callers that do not include `sheetsDestination` are unaffected.

## Full Payload Schema

```typescript
{
  // ── Required ──────────────────────────────────────────────────────────
  clientId: string;          // Identifies the client; must match a record in the clients table

  // ── Existing optional fields (unchanged) ──────────────────────────────
  submitterName?: string;
  submitterEmail?: string;
  submitterMessage?: string;
  submitterPhone?: string;
  submittedFrom?: string;    // URL or identifier of the originating page/form
  formName?: string;         // Human-readable form name shown in the email
  customFields?: Record<string, string>;  // Arbitrary extra fields

  // ── New optional field ────────────────────────────────────────────────
  sheetsDestination?: {
    spreadsheetId: string;   // Required if sheetsDestination is present
                             // The ID from the Google Sheet URL:
                             // docs.google.com/spreadsheets/d/<spreadsheetId>/edit
    sheetName?: string;      // Tab name within the spreadsheet.
                             // Defaults to the first/only sheet if omitted.
    columns?: string[];      // Ordered column mapping.
                             // Each entry is a form field name or "_timestamp".
                             // If omitted: [timestamp, ...all fields in received order]
  };
}
```

## `sheetsDestination` Field Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `spreadsheetId` | Yes (if destination present) | `string` | ID from the Google Sheet URL |
| `sheetName` | No | `string` | Tab name. Omit to target the first sheet. |
| `columns` | No | `string[]` | Column mapping. Omit for default field order. |

### Reserved column identifiers

| Identifier | Value written |
|------------|---------------|
| `"_timestamp"` | UTC ISO-8601 timestamp of the form submission event |

## Example Payloads

### Minimal — no Sheets integration (existing behavior, unchanged)

```json
{
  "clientId": "acme",
  "submitterName": "Jane Doe",
  "submitterEmail": "jane@example.com",
  "submitterMessage": "Hello!"
}
```

### With Sheets destination — default column order

```json
{
  "clientId": "acme",
  "submitterName": "Jane Doe",
  "submitterEmail": "jane@example.com",
  "submitterMessage": "Hello!",
  "sheetsDestination": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
  }
}
```

Row written: `[2026-04-13T09:00:00.000Z, Jane Doe, jane@example.com, Hello!]`

### With Sheets destination — explicit column mapping

```json
{
  "clientId": "acme",
  "submitterName": "Jane Doe",
  "submitterEmail": "jane@example.com",
  "submitterMessage": "Hello!",
  "formName": "Contact Us",
  "sheetsDestination": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    "sheetName": "Contact Form Submissions",
    "columns": ["_timestamp", "submitterName", "submitterEmail", "submitterMessage", "formName"]
  }
}
```

Row written: `[2026-04-13T09:00:00.000Z, Jane Doe, jane@example.com, Hello!, Contact Us]`

### Two forms — two sheets (same client)

**Website A fires:**
```json
{
  "clientId": "acme",
  "submitterEmail": "a@example.com",
  "sheetsDestination": { "spreadsheetId": "SHEET_ID_A", "sheetName": "Site A" }
}
```

**Website B fires:**
```json
{
  "clientId": "acme",
  "submitterEmail": "b@example.com",
  "sheetsDestination": { "spreadsheetId": "SHEET_ID_B", "sheetName": "Site B" }
}
```

Both write to their respective sheets using the same client-level credentials.

## Workflow Behaviour by Environment

| `EMAIL_MODE` | Email | Sheets write |
|-------------|-------|--------------|
| `mock` (local dev) | Console log only | **Skipped** — logged as "skipped (non-live mode)" |
| `test` (preview) | Redirected to TEST_EMAIL | **Skipped** — logged as "skipped (non-live mode)" |
| `live` (production) | Sent to real recipients | **Attempted** — outcome recorded in notification log |

## Prerequisites (client must have configured)

Before `sheetsDestination` can write successfully, the client record must have:
- `google_service_account_key` populated with a valid GCP service account JSON key
- The service account email shared with the target sheet at **Editor** level
- The Google Sheets API enabled in the client's GCP project

Missing credentials → step skipped with a warning logged. Sheets write failure → logged, email delivery unaffected.
