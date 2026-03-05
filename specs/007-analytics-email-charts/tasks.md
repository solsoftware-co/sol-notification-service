# Tasks: Analytics Email Charts

**Input**: Design documents from `/specs/007-analytics-email-charts/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Included — charts.test.ts (new) and templates.test.ts (updated).

**Organization**: Tasks grouped by user story. US1 (daily trend), US2 (top sources), US3 (top pages) are each independently testable and deliverable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm clean baseline before making changes. No new packages or infrastructure required for this feature.

- [X] T001 Verify baseline is green — run `npm run type-check && npm test` and confirm all pass before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the existing CID attachment bug (affects both email templates) and create the shared chart primitives that all three user stories depend on.

**⚠️ CRITICAL**: All user story work is blocked until this phase is complete.

- [X] T002 Update `EmailAttachment` interface in `src/types/index.ts` — replace `headers?: { 'Content-ID': string }` with `content_id?: string` and add `content_type?: string`
- [X] T003 Update attachment mapping in `src/lib/email.ts` — replace `headers` passthrough with `content_id`/`content_type` spread; convert Buffer content to base64 string; add `as any` cast for resend@3.5.0 type gap
- [X] T004 Fix `loadBannerAttachment()` in `src/lib/templates.ts` — replace `headers: { 'Content-ID': '<banner_image.png>' }` with `content_id: 'banner_image.png'` and `content_type: 'image/png'`; convert buffer to base64 string (fixes banner inline embedding for both inquiry and analytics emails)
- [X] T005 Create `src/lib/charts.ts` with the three private primitives: `callQuickChart(chart, height)` (QuickChart HTTP transport), `generateAreaChart(labels, values, height?)` (branded line+fill Chart.js config), and `generateBarChart(labels, values, height?)` (branded horizontal bar Chart.js config) — no public exports yet; apply brand colours from `src/emails/styles.ts`

**Checkpoint**: CID attachment bug fixed for all emails; chart building blocks in place. Run `npm run type-check` to confirm.

---

## Phase 3: User Story 1 — Daily Traffic Trend Chart (Priority: P1) 🎯 MVP

**Goal**: Area chart showing session volume per day appears above the Daily Breakdown table in the analytics email.

**Independent Test**: Run `npm run email:preview`, open `.email-preview/analytics.html`, confirm a filled area chart appears immediately above the Daily Breakdown table with 7 data points matching the table values.

- [X] T006 [P] [US1] Add `generateDailyTrendChart(metrics: DailyMetric[])` public export to `src/lib/charts.ts` — map `metrics` to `labels` (date sliced to `MM-DD`) and `values` (sessions); delegate to `generateAreaChart`; throw on empty input
- [X] T007 [P] [US1] Update `AnalyticsEmailProps` in `src/emails/templates/analytics-report-v1.tsx` — remove old `charts: Array<...>` prop; add `dailyChart?: string`; in the `dailyMetrics` section render `<ChartCard image={dailyChart} title="Daily Sessions" description="Sessions per day" />` immediately above the `<DataTable>` when `dailyChart` is defined; remove the stale `{charts.map(...)}` render block at the bottom
- [X] T008 [US1] Wire daily chart in `src/lib/templates.ts` — in `renderAnalyticsReportEmail`: add `let dailyChartBuf: Buffer | null = null; try { dailyChartBuf = await generateDailyTrendChart(report.dailyMetrics); } catch (e) { /* log */ }`; append `{ filename: 'chart_daily.png', content: dailyChartBuf.toString('base64'), content_id: 'chart_daily', content_type: 'image/png' }` to attachments if non-null; pass `dailyChart: dailyChartBuf ? 'cid:chart_daily' : undefined` to template (depends on T006 + T007)

**Checkpoint**: Daily trend chart renders in preview; fallback to table-only works when `dailyChartBuf` is null.

---

## Phase 4: User Story 2 — Top Traffic Sources Chart (Priority: P2)

**Goal**: Horizontal bar chart showing sessions per source appears above the Top Sources table.

**Independent Test**: Run `npm run email:preview`, confirm a horizontal bar chart appears above the Top Sources table with one bar per source, lengths proportional to session counts.

- [X] T009 [P] [US2] Add `generateTopSourcesChart(sources: TrafficSource[])` public export to `src/lib/charts.ts` — map to `labels` (source name, truncated to 30 chars with `…`) and `values` (sessions); delegate to `generateBarChart`; throw on empty input
- [X] T010 [P] [US2] Add `sourcesChart?: string` prop to `AnalyticsEmailProps` in `src/emails/templates/analytics-report-v1.tsx`; in the `topSources` section render `<ChartCard image={sourcesChart} title="Top Sources" description="Sessions by acquisition channel" />` immediately above the `<DataTable>` when `sourcesChart` is defined
- [X] T011 [US2] Wire sources chart in `src/lib/templates.ts` — add independent try/catch for `generateTopSourcesChart`; append `chart_sources` attachment if non-null; pass `sourcesChart` CID ref to template (depends on T009 + T010)

**Checkpoint**: Sources bar chart renders in preview alongside Daily chart; each section degrades gracefully to table-only if its chart fails.

---

## Phase 5: User Story 3 — Top Pages Chart (Priority: P3)

**Goal**: Horizontal bar chart showing views per page path appears above the Top Pages table.

**Independent Test**: Run `npm run email:preview`, confirm a horizontal bar chart appears above the Top Pages table with one bar per page path, bars proportional to view counts, long paths truncated.

- [X] T012 [P] [US3] Add `generateTopPagesChart(pages: TopPage[])` public export to `src/lib/charts.ts` — map to `labels` (path, truncated to 30 chars with `…`) and `values` (views); delegate to `generateBarChart`; throw on empty input
- [X] T013 [P] [US3] Add `pagesChart?: string` prop to `AnalyticsEmailProps` in `src/emails/templates/analytics-report-v1.tsx`; in the `topPages` section render `<ChartCard image={pagesChart} title="Top Pages" description="Page views by path" />` immediately above the `<DataTable>` when `pagesChart` is defined
- [X] T014 [US3] Wire pages chart in `src/lib/templates.ts` — add independent try/catch for `generateTopPagesChart`; append `chart_pages` attachment if non-null; pass `pagesChart` CID ref to template (depends on T012 + T013)

**Checkpoint**: All three charts render in preview. Analytics email has banner + up to 3 chart attachments. Each chart independently falls back to table-only.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Preview script, tests, and final validation.

- [X] T015 Update `inlineImages()` in `scripts/test-email-preview.ts` — replace the hardcoded `replaceAll('cid:banner_image.png', ...)` with a dynamic loop over `rendered.attachments` that replaces each `cid:{att.content_id}` with `data:{att.content_type};base64,{b64}` for all attachments that have both `content_id` and `content_type`
- [X] T016 [P] Write `tests/unit/lib/charts.test.ts` — stub global `fetch` via `vi.stubGlobal`; verify: (1) `generateDailyTrendChart` sends `type: 'line'` config with correct labels/values, (2) `generateTopSourcesChart` sends `type: 'bar'` + `indexAxis: 'y'` config, (3) `generateTopPagesChart` truncates labels > 30 chars, (4) all three propagate errors from non-ok QuickChart response, (5) both `generateAreaChart` and `generateBarChart` pass `backgroundColor: colors.surface`
- [X] T017 [P] Update `tests/unit/lib/templates.test.ts` — add: (1) `renderAnalyticsReportEmail` with full data returns 4 attachments (banner + 3 charts), (2) returns 2 attachments when `topSources` is empty, (3) returns 3 attachments when one chart fn throws (mock `generateTopSourcesChart` to reject), (4) banner attachment has `content_id: 'banner_image.png'` and no `headers` field
- [X] T018 Run `npm run email:preview` — open `.email-preview/analytics.html` and visually confirm: area chart above daily table, two bar charts above their respective tables, all using brand colours, no broken images
- [X] T019 Run `npm run type-check && npm test` — confirm zero TypeScript errors and all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2 completion; may start after Phase 3 but safe to sequence
- **US3 (Phase 5)**: Depends on Phase 2 completion; may start after Phase 4 but safe to sequence
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — independently testable after Foundational
- **US2 (P2)**: No dependency on US1 or US3 — `generateBarChart` from Phase 2 is the only shared primitive
- **US3 (P3)**: No dependency on US1 or US2 — reuses `generateBarChart`, same pattern as US2

### Within Each User Story (US1 example)

- T006 [P] and T007 [P] touch different files — can run in parallel
- T008 depends on both T006 (chart function must exist to import) and T007 (template prop must exist)

### Same pattern for US2 and US3:

- T009 [P] + T010 [P] → T011
- T012 [P] + T013 [P] → T014

### Polish tasks:

- T015 (preview script) can start after any US is complete
- T016 [P] + T017 [P] can run in parallel (different test files)
- T018 depends on T015 (preview script must be updated)
- T019 depends on T016 + T017

---

## Parallel Examples

### Phase 2 (Foundational)
T002, T003, T004 all touch different files — can run in parallel:
```
T002: src/types/index.ts
T003: src/lib/email.ts
T004: src/lib/templates.ts  (loadBannerAttachment only)
```
T005 depends on T002 (uses `EmailAttachment` type) → run after T002–T004.

### Phase 3 (US1)
```
T006: src/lib/charts.ts          (add generateDailyTrendChart)
T007: src/emails/templates/analytics-report-v1.tsx  (add dailyChart prop)
↓ both complete
T008: src/lib/templates.ts       (wire daily chart)
```

### Phase 6 (Polish)
```
T016: tests/unit/lib/charts.test.ts
T017: tests/unit/lib/templates.test.ts
↓ both complete
T019: npm run type-check && npm test
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005) — also fixes banner CID bug for all emails
3. Complete Phase 3: US1 Daily Chart (T006–T008)
4. **STOP and VALIDATE**: Run `npm run email:preview` — confirm area chart renders above Daily Breakdown table
5. Deliverable: Analytics email with daily trend chart + fixed banner for both email types

### Incremental Delivery

1. Phases 1–3 → Daily trend chart (MVP)
2. Phase 4 → Add sources bar chart
3. Phase 5 → Add pages bar chart
4. Phase 6 → Tests + final validation

### Notes

- T002–T004 are a pure bug fix (CID attachment) and should be committed separately before chart work begins
- T005 creates only private functions — no public API surface, safe to commit before user story phases
- Each user story (T006–T008, T009–T011, T012–T014) can be committed as a unit
- `npm run email:preview` is the primary validation tool — run after each user story phase
