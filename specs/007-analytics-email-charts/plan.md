# Implementation Plan: Analytics Email Charts

**Branch**: `007-analytics-email-charts` | **Date**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-analytics-email-charts/spec.md`

## Summary

Add three branded chart images (area chart for daily traffic, horizontal bar charts for top sources and top pages) to the `analytics-report-v1` email template. Charts are generated server-side by calling the QuickChart API with Chart.js configs, returning PNG buffers that are CID-attached to the email (same mechanism as the banner). Each chart appears above its corresponding data table. This feature also fixes a latent bug where the existing banner CID attachment was being silently dropped by the Resend SDK due to an incorrect `headers` field approach.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: No new npm packages — QuickChart called via `fetch()` (built into Node.js 20+); existing: `@react-email/render`, `resend ^3.x`, `inngest ^3.x`
**Storage**: Neon PostgreSQL — no schema changes
**Testing**: Vitest 2.x — unit tests for chart generation functions and updated template rendering
**Target Platform**: Node.js 20+ / Vercel serverless (Node.js Runtime, not Edge)
**Project Type**: Notification service — server-side email generation
**Performance Goals**: Chart generation < 3 seconds total for all three charts; email size increase < 2 MB
**Constraints**: No external URLs in email; Outlook-compatible (CID inline images); graceful fallback if chart generation fails
**Scale/Scope**: Per-client weekly reports, ~50 clients

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven | ✓ Pass | No new Inngest functions; charts generated inside existing `send-email` step in `weekly-analytics-report.ts` |
| II — Multi-Env Safety | ✓ Pass | Charts generated in all env modes; `EMAIL_MODE=mock` skips Resend send but template rendering is unchanged |
| III — Multi-Tenant | ✓ Pass | Chart generation is per-call, data scoped to each client's report |
| IV — Observability | ✓ Pass | Each chart generation is independently try/caught and logged; step-level logging unchanged |
| V — AI-Agent Friendly | ✓ Pass | Spec exists; new `charts.ts` follows single-responsibility pattern |
| VI — Minimal Infra | ✓ Pass | No new npm packages; QuickChart called via built-in `fetch()`. No self-hosted services or containers. |

---

## Project Structure

### Documentation (this feature)

```text
specs/007-analytics-email-charts/
├── plan.md              ← This file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code Changes

```text
src/
├── types/
│   └── index.ts                    ← Update EmailAttachment: replace headers with content_id/content_type
├── lib/
│   ├── charts.ts                   ← NEW: SVG chart generators + resvg-js PNG conversion
│   ├── templates.ts                ← Update renderAnalyticsReportEmail: generate charts, update attachments
│   └── email.ts                    ← Update attachment mapping to pass content_id/content_type to Resend
└── emails/
    └── templates/
        └── analytics-report-v1.tsx ← Update: replace charts[] with dailyChart/sourcesChart/pagesChart props

tests/
└── unit/
    └── lib/
        ├── charts.test.ts           ← NEW: unit tests for all three chart generators
        └── templates.test.ts        ← Update: add chart attachment assertions

scripts/
└── test-email-preview.ts            ← Update: inline all CID image types (not just banner)
```

---

## Architecture

### New file: `src/lib/charts.ts`

Exports three async functions. Each builds a Chart.js config and POSTs it to the QuickChart API, returning a PNG Buffer. Brand colours from `src/emails/styles.ts` are applied directly in the Chart.js config.

Three-layer call chain:

```
generateDailyTrendChart(metrics)   → generateAreaChart(labels, values)  → callQuickChart(config, h)
generateTopSourcesChart(sources)   → generateBarChart(labels, values)   → callQuickChart(config, h)
generateTopPagesChart(pages)       → generateBarChart(labels, values)   → callQuickChart(config, h)
```

**Layer 1 — `callQuickChart` (private)**: Raw HTTP transport. Accepts a fully-formed Chart.js config object and dimensions, POSTs to QuickChart, returns PNG Buffer.

```ts
async function callQuickChart(chart: object, height: number): Promise<Buffer> {
  const res = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart, width: 760, height, format: 'png', backgroundColor: colors.surface }),
  });
  if (!res.ok) throw new Error(`QuickChart ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

**Layer 2 — `generateAreaChart` / `generateBarChart` (private)**: Build the branded Chart.js config from generic `labels: string[]` + `values: number[]` inputs. This is the single source of truth for all visual styling — colours, fonts, grid lines, legend visibility. Any future change to chart appearance (e.g. colour, tension, bar radius) is made here once and applies to all charts of that type.

```ts
// Area chart — used for time-series data (daily sessions)
async function generateAreaChart(labels: string[], values: number[], height = 220): Promise<Buffer> {
  return callQuickChart({
    type: 'line',
    data: {
      labels,
      datasets: [{ data: values, fill: true,
        borderColor: colors.accent,
        backgroundColor: 'rgba(94,150,199,0.15)',
        pointRadius: 3, tension: 0.3, borderWidth: 2 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.textMuted, font: { size: 11 } }, grid: { color: colors.border } },
        y: { ticks: { color: colors.textMuted, font: { size: 11 } }, grid: { color: colors.border } },
      },
    },
  }, height);
}

// Horizontal bar chart — used for ranked categorical data (sources, pages)
async function generateBarChart(labels: string[], values: number[], height?: number): Promise<Buffer> {
  const h = height ?? labels.length * 40 + 40;
  return callQuickChart({
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values,
        backgroundColor: colors.accent,
        borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.textMuted, font: { size: 11 } }, grid: { color: colors.border } },
        y: { ticks: { color: colors.textSecondary, font: { size: 11 } } },
      },
    },
  }, h);
}
```

**Layer 3 — public exports**: Domain-specific functions that transform typed data into `labels`/`values` arrays and delegate to the appropriate chart primitive.

```ts
export async function generateDailyTrendChart(metrics: DailyMetric[]): Promise<Buffer> {
  const labels = metrics.map(m => m.date.slice(5)); // "MM-DD"
  const values = metrics.map(m => m.sessions);
  return generateAreaChart(labels, values);
}

export async function generateTopSourcesChart(sources: TrafficSource[]): Promise<Buffer> {
  const labels = sources.map(s => s.source.length > 30 ? s.source.slice(0, 29) + '…' : s.source);
  const values = sources.map(s => s.sessions);
  return generateBarChart(labels, values);
}

export async function generateTopPagesChart(pages: TopPage[]): Promise<Buffer> {
  const labels = pages.map(p => p.path.length > 30 ? p.path.slice(0, 29) + '…' : p.path);
  const values = pages.map(p => p.views);
  return generateBarChart(labels, values);
}
```

### Updated: `src/types/index.ts`

```ts
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  content_id?: string;    // replaces headers['Content-ID'] — no angle brackets
  content_type?: string;  // e.g. 'image/png'
}
```

### Updated: `src/lib/email.ts`

Update the Resend attachment mapping to pass `content_id` and `content_type` directly:

```ts
const attachments = request.attachments?.map(a => ({
  filename: a.filename,
  content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
  ...(a.content_id   ? { content_id:   a.content_id }   : {}),
  ...(a.content_type ? { content_type: a.content_type } : {}),
})) as any; // cast required — resend@3.5.0 types don't include content_id yet
```

### Updated: `src/lib/templates.ts`

`renderAnalyticsReportEmail` updated to:
1. Fix banner attachment: add `content_type: 'image/png'`, `content_id: 'banner_image.png'`, remove old `headers` field
2. Generate three charts independently with `try/catch` each
3. Add successful chart buffers as CID attachments
4. Pass CID references (`'cid:chart_daily'` etc.) as optional props to the template

```ts
// Fix banner
const banner: EmailAttachment = {
  filename: 'banner_image.png',
  content: content.toString('base64'),
  content_id: 'banner_image.png',
  content_type: 'image/png',
};

// Generate charts with graceful fallback
let dailyChartBuf: Buffer | null = null;
try { dailyChartBuf = await generateDailyTrendChart(report.dailyMetrics); } catch (e) { logger.warn('chart-daily failed', e); }

// Build attachments
const attachments: EmailAttachment[] = [banner];
if (dailyChartBuf) attachments.push({ filename: 'chart_daily.png', content: dailyChartBuf.toString('base64'), content_id: 'chart_daily', content_type: 'image/png' });
// ... sources, pages same pattern

// Pass to template
AnalyticsReportV1Email({
  ...,
  dailyChart:   dailyChartBuf   ? 'cid:chart_daily'   : undefined,
  sourcesChart: sourcesChartBuf ? 'cid:chart_sources' : undefined,
  pagesChart:   pagesChartBuf   ? 'cid:chart_pages'   : undefined,
})
```

### Updated: `analytics-report-v1.tsx`

Replace `charts: Array<{ title, description, image }>` with three optional props. Each chart renders via `ChartCard` immediately above its table:

```tsx
// Props
dailyChart?: string;
sourcesChart?: string;
pagesChart?: string;

// In JSX — sources section example:
{topSources.length > 0 && (
  <>
    <SectionDivider />
    {sourcesChart && (
      <ChartCard
        image={sourcesChart}
        title="Top Sources"
        description="Sessions by acquisition channel"
      />
    )}
    <DataTable title="Top Sources" columns={['Source', 'Sessions']} rows={...} />
  </>
)}
```

### Updated: `scripts/test-email-preview.ts`

`inlineImages()` updated to replace all chart CIDs (not just the banner) with base64 data URIs generated from the chart buffers returned by `renderAnalyticsReportEmail`. Since `EmailRenderResult` now contains chart PNG buffers in `attachments`, we can build a replacement map dynamically:

```ts
function inlineImages(html: string, attachments: EmailAttachment[]): string {
  let result = html;
  for (const att of attachments) {
    if (att.content_id && att.content_type) {
      const b64 = Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content;
      result = result.replaceAll(`cid:${att.content_id}`, `data:${att.content_type};base64,${b64}`);
    }
  }
  return result;
}
```

---

## Testing Plan

### Unit tests: `tests/unit/lib/charts.test.ts` (new)

Global `fetch` is mocked via `vi.stubGlobal`. Tests are organised by layer:

**`callQuickChart` (via public exports)**:
- Non-ok HTTP response throws an Error (triggers graceful fallback in `templates.ts`)
- Returned `arrayBuffer()` is converted to a Buffer

**`generateAreaChart` / `generateBarChart` (via public exports)**:
- Area chart config has `type: 'line'`, `fill: true`, `borderColor: colors.accent`
- Bar chart config has `type: 'bar'`, `indexAxis: 'y'`, `borderRadius: 4`
- Both pass `backgroundColor: colors.surface` as the chart background

**Public exports (data-to-chart mapping)**:
- `generateDailyTrendChart` maps `DailyMetric.sessions` to values; dates formatted as `MM-DD`
- `generateTopSourcesChart` truncates source labels > 30 chars with `…`
- `generateTopPagesChart` truncates page path labels > 30 chars with `…`
- All three propagate thrown errors for upstream try/catch handling

> Visual correctness validated via `npm run email:preview` (manual review).

### Updated tests: `tests/unit/lib/templates.test.ts`

- `renderAnalyticsReportEmail` returns 4 attachments (banner + 3 charts) when all chart data present
- `renderAnalyticsReportEmail` returns 2 attachments when topSources is empty
- `renderAnalyticsReportEmail` returns 3 attachments when one chart generation fails (mock the chart fn to throw)
- Banner attachment uses `content_id: 'banner_image.png'` (not `headers` field)

---

## Implementation Order

1. **Fix `EmailAttachment` type** — `src/types/index.ts`
3. **Fix `email.ts` attachment mapping** — replace `headers` with `content_id`/`content_type`
4. **Fix banner attachment** in `src/lib/templates.ts` — use `content_id`, drop `headers`
5. **Create `src/lib/charts.ts`** — three chart generators
6. **Wire charts in `templates.ts`** — generate, attach, pass CID refs
7. **Update `analytics-report-v1.tsx`** — replace `charts[]` with per-section props
8. **Update `scripts/test-email-preview.ts`** — dynamic CID inlining
9. **Write tests** — `charts.test.ts` + update `templates.test.ts`
10. **Run `npm run email:preview`** — visual validation
11. **Run `npm run type-check && npm test`** — CI validation
