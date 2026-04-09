# Developer Quickstart: Analytics Excel Export (013)

**Branch**: `013-analytics-excel-export`

## Prerequisites

Standard dev setup (see root README). No new environment variables required.

## Install the new dependency

```bash
npm install xlsx
```

## Run in mock mode (local dev)

```bash
npm run email:preview
```

This triggers `renderAnalyticsReportEmail` with mock data. Check `.email-preview/last.html` to verify the email renders, and inspect the terminal output for `[mock] Would send...` confirmation that the attachment was generated. The mock data will produce a valid Excel buffer — any error in `buildAnalyticsExcel` will appear as a log warning (not a thrown error).

## Inspect the Excel attachment locally

Add a temporary debug line in `src/lib/templates.ts` after the try/catch:

```typescript
// Temporary debug — remove before PR
import { writeFileSync } from 'node:fs';
if (excelBuf) writeFileSync('/tmp/debug-report.xlsx', excelBuf);
```

Then run `npm run email:preview` and open `/tmp/debug-report.xlsx` in Excel or Google Sheets to verify all sheets and data.

## Run tests

```bash
npm test
```

Unit tests for `buildAnalyticsExcel` live at `tests/unit/lib/excel.test.ts`. No mock of `xlsx` is needed — the real library runs in tests (it has no side effects and produces deterministic output).

## Key files

| File | Role |
|------|------|
| `src/lib/excel.ts` | New — Excel workbook builder |
| `src/lib/templates.ts` | Modified — calls `buildAnalyticsExcel`, appends to attachments |
| `tests/unit/lib/excel.test.ts` | New — unit tests for workbook builder |
| `specs/013-analytics-excel-export/` | This spec and all plan artifacts |

## No DB migration needed

`npm run db:migrate` is not required for this feature. No schema changes.
