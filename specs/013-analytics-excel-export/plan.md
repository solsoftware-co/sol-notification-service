# Implementation Plan: Analytics Excel Export Attachment

**Branch**: `013-analytics-excel-export` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/013-analytics-excel-export/spec.md`

## Summary

Attach an Excel (.xlsx) spreadsheet to every outgoing analytics report email. The workbook is built from the same `AnalyticsReport` data that populates the HTML email, organized into up to five named sheets: Summary, Top Pages, Traffic Sources, Daily Breakdown, and (conditionally) Historical Comparison. Generation follows the established chart-generation pattern — try/catch inside `renderAnalyticsReportEmail()`, non-blocking on failure. The only new dependency is `xlsx` (SheetJS Community Edition, Apache 2.0, CJS-compatible, Buffer output).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `xlsx ^0.18.5` (new) + existing: `inngest ^3.x`, `resend ^3.x`, `@react-email/render`, `pino ^10.x`  
**Storage**: Neon PostgreSQL — no schema changes  
**Testing**: Vitest 2.x  
**Target Platform**: Vercel Hobby (serverless Node.js functions)  
**Project Type**: Notification service (event-driven workflow)  
**Performance Goals**: Excel buffer < 1MB for standard reports; generation < 500ms  
**Constraints**: No new infrastructure; in-memory only (no file persistence); Excel failure must not block email  
**Scale/Scope**: One workbook generated per client per scheduled report run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ Pass | Excel generation inside existing `send-email` step (`step.run` wrapper already present). No synchronous delivery path added. |
| II — Multi-Environment Safety | ✅ Pass | Mock mode generates Excel from mock data (same path). `email.ts` already handles attachments in all modes. |
| III — Multi-Tenant by Design | ✅ Pass | `buildAnalyticsExcel(report, client, period)` receives `client` as parameter; filename includes client slug. No hardcoded client data. |
| IV — Observability by Default | ✅ Pass | Excel generation failure logged with `log()`. Success/failure captured in existing `log-result` step. |
| V — AI-Agent Friendly | ✅ Pass | Spec exists. New function follows established `src/lib/` pattern. Types unchanged. |
| VI — Minimal Infrastructure | ⚠️ Amendment Note | One new npm package (`xlsx`) added. Constitution Technology Stack requires MINOR version amendment to ratify. No new infrastructure services. See Complexity Tracking. |

**Post-Phase 1 re-check**: All gates still pass after design. The implementation adds one new library file and modifies one existing file — minimal footprint.

## Project Structure

### Documentation (this feature)

```text
specs/013-analytics-excel-export/
├── spec.md           ✅ Complete
├── plan.md           ✅ This file
├── research.md       ✅ Complete
├── data-model.md     ✅ Complete
├── quickstart.md     ✅ Complete
├── contracts/        — N/A (internal library function; no external interface)
└── tasks.md          — Phase 2 output (/speckit.tasks command)
```

### Source Code Changes

```text
src/
└── lib/
    ├── excel.ts          NEW  — buildAnalyticsExcel(report, client, period): Promise<Buffer>
    └── templates.ts      MODIFY  — renderAnalyticsReportEmail: add Excel try/catch block,
                                    append xlsx attachment to attachments[]

tests/
└── unit/
    └── lib/
        └── excel.test.ts  NEW  — unit tests for buildAnalyticsExcel

package.json              MODIFY  — add xlsx dependency
```

No changes to:
- `src/inngest/functions/analytics-report.ts` — workflow unchanged
- `src/types/index.ts` — all types already sufficient
- `db/migrations/` — no schema changes
- `.github/workflows/` — no CI changes needed (existing test job covers new tests)

## Implementation Design

### New File: `src/lib/excel.ts`

Single exported function. No side effects. Pure data transformation.

```typescript
import * as XLSX from 'xlsx';
import type { AnalyticsReport, ClientRow, ResolvedPeriod } from '../types/index';

export async function buildAnalyticsExcel(
  report: AnalyticsReport,
  client: ClientRow,
  period: ResolvedPeriod,
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  // Sheet 2: Top Pages
  // Sheet 3: Traffic Sources
  // Sheet 4: Daily Breakdown
  // Sheet 5: Historical (conditional — only when historicalPeriods non-empty and preset !== 'custom')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function buildExcelFilename(client: ClientRow, period: ResolvedPeriod): string {
  const slug = client.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `analytics-${slug}-${period.start}-${period.end}.xlsx`;
}
```

### Modified: `src/lib/templates.ts` — `renderAnalyticsReportEmail`

Add after chart generation and before `const html = await render(...)`:

```typescript
let excelBuf: Buffer | null = null;
try {
  excelBuf = await buildAnalyticsExcel(report, client, period);
} catch (e) {
  log(`[excel] workbook generation failed: ${e}`);
}

if (excelBuf) {
  attachments.push({
    filename: buildExcelFilename(client, period),
    content: excelBuf,
    content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
```

### Workbook Sheet Details

**Sheet 1 — Summary** (label-value pairs, not columnar):

| Row | A | B |
|-----|---|---|
| 1 | Report Period | period.label |
| 2 | Date Range | "{start} to {end}" |
| 3 | Total Sessions | sessions (number) |
| 4 | Active Users | activeUsers (number) |
| 5 | New Users | newUsers (number) |
| 6 | Avg Session Duration | "Xm Ys" formatted string |

**Sheet 2 — Top Pages** (header row + data rows):
`Page Path | Page Views`

**Sheet 3 — Traffic Sources**:
`Source | Sessions`

**Sheet 4 — Daily Breakdown**:
`Date | Sessions | Active Users | New Users`

**Sheet 5 — Historical** (only when applicable):
`Period | Sessions | Active Users | New Users | Avg Session Duration`  
Rows: historical snapshots (oldest first) + current period as final row labeled "Current Period"

### Testing Strategy

**Unit tests for `buildAnalyticsExcel`** (`tests/unit/lib/excel.test.ts`):
- Returns a `Buffer` instance for standard report data
- Workbook contains exactly 4 sheets when no historical periods
- Workbook contains exactly 5 sheets when historical periods present
- Historical sheet absent when preset === 'custom' (even if historicalPeriods populated)
- Sheet row counts match input array lengths (topPages.length + 1 header, etc.)
- Filename function produces expected slug format
- Zero data → still returns valid Buffer (empty sheets, not an error)

Use `XLSX.read(buf)` in tests to parse the output and assert sheet names/content. No mocking needed — `xlsx` is a pure in-memory library.

**Integration coverage**: Existing e2e email tests will exercise the full path when the Excel attachment is present. No new e2e test files required for this feature (no new Inngest event or flow registered).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New package `xlsx` (Constitution §VI Technology Stack amendment required) | Excel generation is impossible without an xlsx serialization library. No built-in Node.js API produces the Office Open XML format. | Hand-rolling xlsx format (ZIP + XML) would be hundreds of lines of brittle, untested code for a format with dozens of edge cases — clearly worse than a 7.8M-download library. |

**Governance action**: Constitution Technology Stack table should be updated with a MINOR version bump to add `xlsx` (Apache 2.0, SheetJS Community Edition) as an approved dependency.
