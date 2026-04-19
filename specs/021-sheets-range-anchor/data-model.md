# Data Model: Configurable Google Sheets Range Anchor

**Feature**: 021-sheets-range-anchor
**Date**: 2026-04-19

---

## Modified Entity: `GoogleSheetsDestination`

Located in `src/types/index.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spreadsheetId` | `string` | Yes | Google Spreadsheet ID (from the URL) |
| `sheetName` | `string` | No | Tab/sheet name. Defaults to first sheet if omitted |
| `columns` | `string[]` | No | Ordered field identifiers mapping submission fields to columns. If omitted: writes `[timestamp, ...all fields]` |
| `tableAnchor` | `string` | No | **(NEW)** Cell reference for the top-left of the target table (e.g., `"B2"`, `"C5"`). Defaults to `"A1"` if omitted |

### Range Resolution Logic

The resolved range string passed to the Sheets API is built as:

```
[sheetName!]<tableAnchor or "A1">
```

| `sheetName` | `tableAnchor` | Resolved range |
|-------------|---------------|----------------|
| absent | absent | `A1` |
| `"Sheet1"` | absent | `Sheet1!A1` |
| absent | `"B2"` | `B2` |
| `"Sheet1"` | `"B2"` | `Sheet1!B2` |

### Validation Rules

- `tableAnchor` is optional; no format validation is performed by the service.
- An invalid cell reference results in a Sheets API error, captured as `{ success: false, error: "..." }` — no silent failure.

---

## No schema changes

This feature touches only the TypeScript type definition and the range-building logic in `src/lib/sheets.ts`. No database migrations are required.
