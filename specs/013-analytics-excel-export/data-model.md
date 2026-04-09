# Data Model: Analytics Excel Export (013)

**Date**: 2026-04-08  
**Status**: Complete

---

## Overview

No new database tables or entities are introduced. This feature is a pure output transformation: existing `AnalyticsReport` data is reshaped into an Excel workbook and attached to the outgoing email. All entities are already defined in `src/types/index.ts`.

---

## Source Entities (Existing — Unchanged)

### AnalyticsReport

The single source of truth. All Excel sheet data derives from this object.

```
AnalyticsReport
├── sessions: number
├── activeUsers: number
├── newUsers: number
├── avgSessionDurationSecs: number
├── topPages: TopPage[]              → Excel "Top Pages" sheet
├── topSources: TrafficSource[]      → Excel "Traffic Sources" sheet
├── dailyMetrics: DailyMetric[]      → Excel "Daily Breakdown" sheet
├── resolvedPeriod: ResolvedPeriod   → Excel "Summary" sheet header
├── isMock: boolean
└── historicalPeriods?: HistoricalPeriodSnapshot[]  → Excel "Historical" sheet (optional)
```

### ResolvedPeriod

```
ResolvedPeriod
├── start: string      (ISO 8601, e.g. "2026-02-16") → Summary sheet + filename
├── end: string        (ISO 8601, e.g. "2026-02-22") → Summary sheet + filename
├── label: string      (e.g. "Feb 16 – Feb 22, 2026") → Summary sheet
└── preset: ReportPeriodPreset
```

### ClientRow

```
ClientRow
├── name: string    → slugified for Excel filename
└── email: string   → (not in Excel, used by email layer)
```

---

## Derived Output: Excel Workbook

The Excel workbook is an in-memory artifact (never persisted). It is produced by `buildAnalyticsExcel()` and lives only as a `Buffer` passed to the email attachment array.

### Sheet 1: Summary

| Column | Source | Notes |
|--------|--------|-------|
| Report Period | `resolvedPeriod.label` | First row, merged label |
| Date Range | `resolvedPeriod.start` – `resolvedPeriod.end` | Second row |
| Total Sessions | `report.sessions` | Numeric |
| Active Users | `report.activeUsers` | Numeric |
| New Users | `report.newUsers` | Numeric |
| Avg Session Duration | `report.avgSessionDurationSecs` | Formatted as "Xm Ys" |

### Sheet 2: Top Pages

| Column | Source | Notes |
|--------|--------|-------|
| Page Path | `topPage.path` | Raw path, e.g. "/about" |
| Page Views | `topPage.views` | Numeric |

Rows: one per entry in `report.topPages` (ordered as returned — highest views first)

### Sheet 3: Traffic Sources

| Column | Source | Notes |
|--------|--------|-------|
| Source | `trafficSource.source` | Raw source value |
| Sessions | `trafficSource.sessions` | Numeric |

Rows: one per entry in `report.topSources` (ordered as returned — highest sessions first)

### Sheet 4: Daily Breakdown

| Column | Source | Notes |
|--------|--------|-------|
| Date | `dailyMetric.date` | ISO 8601 |
| Sessions | `dailyMetric.sessions` | Numeric |
| Active Users | `dailyMetric.activeUsers` | Numeric |
| New Users | `dailyMetric.newUsers` | Numeric |

Rows: one per entry in `report.dailyMetrics` (ordered chronologically)

### Sheet 5: Historical (conditional)

Present only when `report.historicalPeriods` is non-empty AND `resolvedPeriod.preset !== "custom"`.

| Column | Source | Notes |
|--------|--------|-------|
| Period | `snapshot.periodLabel` | Human-readable label |
| Sessions | `snapshot.sessions` | Numeric |
| Active Users | `snapshot.activeUsers` | Numeric |
| New Users | `snapshot.newUsers` | Numeric |
| Avg Session Duration | `snapshot.avgSessionDurationSecs` | Formatted as "Xm Ys" |

Rows: one per entry in `report.historicalPeriods` (oldest first), followed by a "Current Period" row with current-period values.

---

## Filename Convention

```
analytics-{client-slug}-{start}-{end}.xlsx

client-slug: client.name lowercased, spaces → hyphens, non-alphanumeric characters stripped
start: resolvedPeriod.start (ISO 8601, e.g. "2026-02-16")
end: resolvedPeriod.end (ISO 8601, e.g. "2026-02-22")

Example: analytics-acme-corp-2026-02-16-2026-02-22.xlsx
```

---

## New Function Signature

```typescript
// src/lib/excel.ts
export async function buildAnalyticsExcel(
  report: AnalyticsReport,
  client: ClientRow,
  period: ResolvedPeriod,
): Promise<Buffer>
```

Returns an xlsx-format `Buffer`. Throws only for truly unrecoverable errors (caller wraps in try/catch).

---

## Schema Changes

None. This feature requires no database migrations.
