# Event Payload Contract: `form/submitted` — sheetsDestination

**Feature**: 021-sheets-range-anchor

This contract documents the `sheetsDestination` field of the `form/submitted` event payload after this feature.

---

## `sheetsDestination` (optional)

```jsonc
{
  "sheetsDestination": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",  // required
    "sheetName": "Inquiries",                                             // optional
    "tableAnchor": "B2",                                                  // optional — NEW
    "columns": [                                                          // optional
      "_timestamp",
      "submitterName",
      "submitterEmail",
      "submitterMessage"
    ]
  }
}
```

### Field: `tableAnchor`

- **Type**: `string`
- **Required**: No
- **Default**: `"A1"` (existing behavior preserved)
- **Format**: Standard spreadsheet cell reference — column letter(s) + row number (e.g., `"A1"`, `"B2"`, `"C10"`, `"AA3"`)
- **Effect**: Sets the top-left corner of the table the Sheets API should append to. The API finds the first empty row after the last occupied row in that table and inserts there.

### Example: table starting at B2 (header row 2, data from row 3)

```json
{
  "clientId": "hwhomes",
  "submitterName": "Jane Doe",
  "submitterEmail": "jane@example.com",
  "sheetsDestination": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    "sheetName": "Inquiry Log",
    "tableAnchor": "B2",
    "columns": ["_timestamp", "submitterName", "submitterEmail", "submitterMessage"]
  }
}
```

This will append one row immediately below the last occupied row in the `B`-column table on the `Inquiry Log` sheet.

---

## Backwards compatibility

Omitting `tableAnchor` is identical to the current behaviour. No changes are required to existing event payloads.
