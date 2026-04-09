# Research: Analytics Excel Export (013)

**Date**: 2026-04-08  
**Status**: Complete — all unknowns resolved

---

## Decision 1: Excel Generation Library

**Decision**: Use `xlsx` (SheetJS Community Edition) from the npm registry.

**Rationale**:
- 7.8M weekly downloads — most adopted Excel library in the Node.js ecosystem
- Actively maintained (latest releases via cdn.sheetjs.com; npm registry has 0.18.5 which covers all required API surface)
- Full CJS `require()` support — aligns with project's CommonJS module system
- `XLSX.write(wb, { type: "buffer", bookType: "xlsx" })` returns a true Node.js `Buffer` — no ArrayBuffer conversion workaround needed
- Specifically documented for Vercel serverless and HTTP response scenarios
- Supports multiple named sheets in one workbook — required by FR-004 through FR-008
- License: Apache 2.0 (permissive — fine for this project)

**Alternatives considered**:
- `exceljs` — MIT license, good TypeScript types, BUT known `writeBuffer()` ArrayBuffer bug (returns ArrayBuffer, not Buffer); maintenance inactive 12+ months as of 2026-04
- `node-xlsx` — wrapper around `xlsx` with no added value for our write-only use case; lower adoption; stale
- `fast-xlsx-writer` — write-only but limited multi-sheet support documentation; minimal adoption

**Installation**: `npm install xlsx`  
(npm registry 0.18.5 is sufficient — all APIs used are stable and unchanged since initial release)

**TypeScript types**: The `xlsx` package ships its own type definitions. No `@types/xlsx` needed.

---

## Decision 2: Resend Attachment Support for .xlsx

**Decision**: Resend already supports `.xlsx` attachments — no changes to email sending layer needed.

**Rationale**:
- `src/lib/email.ts` already implements attachment handling for all modes:
  - **live/test** (Resend): base64-encodes `Buffer` content before passing to SDK
  - **mailtrap**: passes raw Buffer via nodemailer
  - **mock**: passes through to `writeEmailPreview()`
- Resend total email size limit: 40MB — well above the expected ~50–200KB attachment
- No MIME type restrictions documented; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` is standard and supported
- `EmailAttachment` type in `src/types/index.ts` already has `filename`, `content`, `content_id`, `content_type` fields

**Conclusion**: Zero changes required to the email sending infrastructure. The Excel `Buffer` just needs to be appended to the `attachments` array in `renderAnalyticsReportEmail()`.

---

## Decision 3: Excel Generation Placement (New Step vs. Inside render function)

**Decision**: Generate Excel inside `renderAnalyticsReportEmail()` with try/catch — NOT as a separate Inngest step.

**Rationale**:
- Chart generation already follows this exact pattern in `src/lib/templates.ts` (each chart has its own try/catch, failure is logged but never throws)
- This ensures non-blocking failure: if Excel generation fails, the HTML email still sends (FR-010)
- Adding a dedicated `generate-excel` Inngest step would change the function signature and add an extra retry-able unit for something that is an enhancement, not a critical path
- The `send-email` step already produces all the artifacts (HTML + attachments) — Excel is just another attachment in that bundle

**Pattern reference**: Lines 234–242 in `src/lib/templates.ts`:
```typescript
try {
  dailyChartBuf = await generateDailyTrendChart(report.dailyMetrics);
} catch (e) {
  log(`[charts] daily trend chart failed: ${e}`);
}
```

---

## Decision 4: Filename Format

**Decision**: `analytics-{slug}-{start}-{end}.xlsx`

**Format**: client name slugified (lowercase, spaces→hyphens, non-alphanumeric stripped) + date range from `resolvedPeriod.start` and `resolvedPeriod.end` (e.g., `analytics-acme-corp-2026-02-16-2026-02-22.xlsx`)

**Rationale**: Descriptive enough for a client to know what the file contains without opening it. ISO date format is unambiguous and sorts correctly in file explorers.

---

## Unresolved Items

None. All spec requirements have clear implementation paths. Ready for Phase 1 design.
