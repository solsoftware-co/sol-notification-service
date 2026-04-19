# Quickstart: Using `tableAnchor` in a Sheets Destination

**Feature**: 021-sheets-range-anchor

---

## When do you need this?

If the Google Sheet your client uses has a table that does **not** start at cell A1 — for example:
- Row 1 is blank or contains a logo/title
- Column headers begin at B2 (or C3, etc.)
- Data rows start at B3

Without `tableAnchor`, the service defaults to `A1` and the Sheets API may append to the wrong location.

---

## How to configure it

Add `tableAnchor` to your `sheetsDestination` in the `form/submitted` event payload.

Set it to the **header row cell** — the top-left corner of your table. The API will append new data rows automatically below the last occupied row in that table.

**Example** — headers at B2, data starts at B3:

```json
{
  "clientId": "your-client-id",
  "submitterName": "Jane Doe",
  "submitterEmail": "jane@example.com",
  "sheetsDestination": {
    "spreadsheetId": "YOUR_SPREADSHEET_ID",
    "sheetName": "Inquiry Log",
    "tableAnchor": "B2",
    "columns": ["_timestamp", "submitterName", "submitterEmail", "submitterMessage"]
  }
}
```

---

## What `tableAnchor` does

It tells the Sheets API where your table lives. The API then:
1. Finds the last occupied row in that table
2. Appends your new row immediately below it

The `columns` field still controls which form fields map to which columns and in what order — `tableAnchor` only sets the table location.

---

## Default behavior (no change required for existing clients)

If you omit `tableAnchor`, the service uses `A1` — exactly the same as before this feature.
