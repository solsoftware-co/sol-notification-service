# Tasks: Analytics Excel Export Attachment (013)

**Input**: Design documents from `/specs/013-analytics-excel-export/`
**Branch**: `013-analytics-excel-export`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Install the one new dependency this feature requires.

- [x] T001 Install `xlsx` dependency — run `npm install xlsx` from repo root (updates `package.json` and `package-lock.json`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the new module stub and update existing test infrastructure so all user story phases can proceed without TS errors or test regressions.

**⚠️ CRITICAL**: Complete both tasks before starting any user story work.

- [x] T002 Create `src/lib/excel.ts` stub — export `buildAnalyticsExcel(report: AnalyticsReport, client: ClientRow, period: ResolvedPeriod): Promise<Buffer>` and `buildExcelFilename(client: ClientRow, period: ResolvedPeriod): string` with correct TypeScript signatures importing from `../types/index`; bodies may throw `new Error('not implemented')` at this stage
- [x] T003 [P] Add `xlsx` mock to `tests/unit/lib/templates.test.ts` — add `vi.hoisted(() => vi.fn())` mock refs for `mockBuildAnalyticsExcel` and `mockBuildExcelFilename`; add `vi.mock('../../../src/lib/excel', () => ({ buildAnalyticsExcel: mockBuildAnalyticsExcel, buildExcelFilename: mockBuildExcelFilename }))` following the existing chart mock pattern at the top of the file; set `mockBuildAnalyticsExcel.mockResolvedValue(Buffer.from('fake-xlsx'))` and `mockBuildExcelFilename.mockReturnValue('analytics-acme-corp-2026-02-16-2026-02-22.xlsx')` in `beforeEach`

**Checkpoint**: `npm run type-check` passes; `npm test` still passes with all existing tests green.

---

## Phase 3: User Story 1 — Receive Excel with Analytics Email (Priority: P1) 🎯 MVP

**Goal**: Every analytics report email includes a valid `.xlsx` attachment with four data sheets (Summary, Top Pages, Traffic Sources, Daily Breakdown). Attachment failure never blocks email delivery.

**Independent Test**: Trigger `npm run email:preview` — terminal output shows `[mock] Would send...` with no `[excel] workbook generation failed` warning. Run `npm test` — all `excel.test.ts` tests pass.

### Implementation for User Story 1

- [x] T004 [US1] Implement `buildExcelFilename` in `src/lib/excel.ts` — return `analytics-{slug}-{start}-{end}.xlsx` where slug is `client.name` lowercased, spaces replaced with hyphens, non-alphanumeric characters stripped; start/end come from `period.start` and `period.end` (ISO 8601 strings)
- [x] T005 [US1] Implement four-sheet workbook in `buildAnalyticsExcel` in `src/lib/excel.ts` — use `XLSX.utils.book_new()` then `XLSX.utils.aoa_to_sheet()` for each sheet:
  - **Summary** sheet: label-value pairs — "Report Period" / `period.label`, "Date Range" / `"{start} to {end}"`, "Total Sessions" / `report.sessions` (number), "Active Users" / `report.activeUsers`, "New Users" / `report.newUsers`, "Avg Session Duration" / formatted string `"Xm Ys"` (compute from `report.avgSessionDurationSecs`)
  - **Top Pages** sheet: header row `["Page Path", "Page Views"]` + one row per `report.topPages` entry (`[page.path, page.views]`)
  - **Traffic Sources** sheet: header row `["Source", "Sessions"]` + one row per `report.topSources` entry (`[source.source, source.sessions]`)
  - **Daily Breakdown** sheet: header row `["Date", "Sessions", "Active Users", "New Users"]` + one row per `report.dailyMetrics` entry
  - Append each sheet via `XLSX.utils.book_append_sheet(wb, sheet, sheetName)`; return `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer`
- [x] T006 [P] [US1] Write unit tests in `tests/unit/lib/excel.test.ts` using the real `xlsx` library (no mocking) — import `buildAnalyticsExcel` and `buildExcelFilename`; use `XLSX.read(buf)` to parse output and assert:
  - Returns a `Buffer` instance for standard mock report data
  - Workbook contains exactly 4 sheets when `historicalPeriods` is undefined: sheet names are `["Summary", "Top Pages", "Traffic Sources", "Daily Breakdown"]`
  - Top Pages sheet has `topPages.length + 1` rows (header + data)
  - Traffic Sources sheet has `topSources.length + 1` rows
  - Daily Breakdown sheet has `dailyMetrics.length + 1` rows
  - `buildExcelFilename` returns `"analytics-acme-corp-2026-02-16-2026-02-22.xlsx"` for client name `"Acme Corp"` and period `{ start: "2026-02-16", end: "2026-02-22" }`
  - Empty arrays for `topPages`, `topSources`, `dailyMetrics` still return a valid `Buffer` (no throw)
- [x] T007 [US1] Update `renderAnalyticsReportEmail` in `src/lib/templates.ts` — after chart generation blocks and before `const html = await render(...)`, add: import `{ buildAnalyticsExcel, buildExcelFilename }` from `./excel` at top of file; add try/catch block: `let excelBuf: Buffer | null = null; try { excelBuf = await buildAnalyticsExcel(report, client, period); } catch (e) { log(\`[excel] workbook generation failed: \${e}\`); }` then `if (excelBuf) { attachments.push({ filename: buildExcelFilename(client, period), content: excelBuf, content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); }`
- [x] T008 [US1] Update `tests/unit/lib/templates.test.ts` — find any test assertions on `attachments` array length or contents from `renderAnalyticsReportEmail` and update expected counts to include the Excel attachment (banner + charts + 1 xlsx); verify `mockBuildAnalyticsExcel` is called with `(report, client, period)` in at least one test; add a test asserting that when `mockBuildAnalyticsExcel` rejects, `renderAnalyticsReportEmail` still resolves successfully (non-blocking failure)

**Checkpoint**: `npm test` passes. `npm run email:preview` produces no Excel error in console. User Story 1 is complete and independently verifiable.

---

## Phase 4: User Story 2 — Historical Comparison Sheet (Priority: P2)

**Goal**: When prior period snapshots are present and the preset is not `"custom"`, a fifth "Historical" sheet is included in the workbook. When absent or custom, the sheet is not present.

**Independent Test**: Run `npm test` — historical-sheet tests in `excel.test.ts` pass for all three cases (present, absent-custom, absent-empty).

### Implementation for User Story 2

- [x] T009 [P] [US2] Add historical sheet unit tests in `tests/unit/lib/excel.test.ts`:
  - When `historicalPeriods` is non-empty and `preset !== 'custom'` → workbook has 5 sheets, 5th sheet named `"Historical"`, row count equals `historicalPeriods.length + 2` (header + snapshot rows + "Current Period" row)
  - When `preset === 'custom'` even with `historicalPeriods` populated → workbook has 4 sheets, no "Historical" sheet
  - When `historicalPeriods` is an empty array → workbook has 4 sheets, no "Historical" sheet
- [x] T010 [US2] Implement conditional Historical sheet in `buildAnalyticsExcel` in `src/lib/excel.ts` — after building the four core sheets, check `if (report.historicalPeriods && report.historicalPeriods.length > 0 && period.preset !== 'custom')`: build Historical sheet with header row `["Period", "Sessions", "Active Users", "New Users", "Avg Session Duration"]` + one row per `historicalPeriods` snapshot (oldest first) + a final row for the current period labeled `"Current Period"` with `report.sessions`, `report.activeUsers`, `report.newUsers`, and formatted `avgSessionDurationSecs`; append as 5th sheet named `"Historical"`

**Checkpoint**: `npm test` passes. Workbook produced by `npm run email:preview` with mock data that includes historical periods contains 5 sheets. User Story 2 is complete.

---

## Phase 5: User Story 3 — Cross-Trigger Consistency (P3)

**Goal**: Confirm the attachment is present regardless of how the report is triggered. No new implementation — this is a validation gate.

**Independent Test**: Manual trigger via Inngest Dev UI produces an email with the Excel attachment.

### Validation for User Story 3

- [x] T011 [US3] Validate mock-mode attachment via `npm run email:preview` — confirm terminal shows no `[excel] workbook generation failed` warning; optionally add a temporary `writeFileSync('/tmp/debug-report.xlsx', excelBuf)` call in `templates.ts` (per `quickstart.md`) to open and visually inspect the workbook in a spreadsheet app, then remove before PR

**Checkpoint**: All three trigger paths (automated cron, manual Dev UI, custom range) produce an email with the xlsx attachment. User Story 3 complete.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T012 Run `npm run type-check` — resolve any TypeScript errors in `src/lib/excel.ts` and `src/lib/templates.ts`; ensure `import * as XLSX from 'xlsx'` resolves correctly with the installed package types
- [x] T013 [P] Run `npm test` — verify full test suite passes: all pre-existing tests green, all new `excel.test.ts` tests green, updated `templates.test.ts` assertions green
- [x] T014 Update constitution Technology Stack table in `.specify/memory/constitution.md` — add row for `xlsx` (SheetJS Community Edition, Apache 2.0) under the Technology Stack section; bump constitution version from `1.1.1` to `1.2.0` (MINOR — new approved package) and update `Last Amended` date

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 must complete before T002 can import `xlsx`)
- **Phase 3 (US1)**: Depends on Phase 2 — T002 and T003 must both be complete
- **Phase 4 (US2)**: Depends on Phase 3 — `buildAnalyticsExcel` must exist before adding the conditional branch
- **Phase 5 (US3)**: Depends on Phase 3 — attachment must exist to validate
- **Final Phase**: Depends on all story phases

### Within Phase 3 (US1)

- T004 → T005 (filename before workbook — used in T007)
- T004, T005 → T006 [P] (tests can be written alongside implementation, different file)
- T005 → T007 (workbook builder must exist before templates.ts calls it)
- T007 → T008 (templates must be updated before verifying template test assertions)

### Parallel Opportunities

- T003 (templates mock setup) runs in parallel with T002 (excel.ts stub) — different files
- T006 (excel unit tests) runs in parallel with T004/T005 (excel implementation) — same file but tests written first, then implementation fills them
- T009 (historical tests) runs in parallel with T010 (historical implementation) — same approach
- T012 and T013 run in parallel — type-check and test are independent commands

---

## Parallel Example: User Story 1

```bash
# These two run in parallel (different files):
Task T003: "Add xlsx mock to tests/unit/lib/templates.test.ts"
Task T002: "Create src/lib/excel.ts stub"

# After T002 completes, these two can overlap:
Task T004: "Implement buildExcelFilename in src/lib/excel.ts"
Task T006: "Write unit tests in tests/unit/lib/excel.test.ts" (write failing tests first)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Install `xlsx`
2. Complete Phase 2: Create stub + add test mocks
3. Complete Phase 3: Implement workbook builder + wire into templates
4. **STOP and VALIDATE**: `npm test` passes; `npm run email:preview` shows attachment
5. Ship — this alone delivers the full client-facing value

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (~15 min)
2. Phase 3 (US1) → Core attachment working → validate and ship as MVP
3. Phase 4 (US2) → Historical sheet added → incremental improvement
4. Phase 5 (US3) → Validation only, no implementation
5. Final Phase → Type-check, tests, constitution amendment

### Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | 1 | — |
| Foundational | 2 | — |
| US1 (P1 MVP) | 5 | US1 |
| US2 (P2) | 2 | US2 |
| US3 (P3) | 1 | US3 |
| Polish | 3 | — |
| **Total** | **14** | |
