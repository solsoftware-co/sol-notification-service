# Research: Analytics Email Charts

**Feature**: 007-analytics-email-charts
**Date**: 2026-03-04

---

## Decision 1: Chart Generation Strategy

**Decision**: QuickChart API (`https://quickchart.io/chart`) — server-side HTTP call returning a PNG buffer

**Rationale**:
- No new npm packages required — uses `fetch()` built into Node.js 20+
- Chart.js config format is the industry standard; produces polished, professional charts with zero geometry math
- Called server-side at email generation time, so the email client never reaches any external URL — charts are CID-attached PNGs (satisfies FR-004)
- Dramatically simpler implementation (~20 lines per chart vs ~150 lines of SVG geometry)
- Graceful fallback already planned (try/catch per chart) covers the external service availability risk

**Trade-offs accepted**:
- Client analytics data (session counts, page paths, source names) is sent to `quickchart.io` servers at generation time — acceptable for PoC with trusted clients; revisit for enterprise/compliance requirements
- External dependency: if `quickchart.io` is unreachable, chart generation fails and falls back to table-only (FR-010 satisfied)
- Rate limits: QuickChart free tier is generous for low-volume use (~50 clients/week); no paid plan required for PoC scale

**Alternatives Considered**:
- Hand-authored SVG + `@resvg/resvg-js` — Zero external dependency, but ~150 lines of geometry math per chart type and a ~5 MB binary dependency. Overkill for three simple charts.
- `chartjs-node-canvas` — Requires native Cairo system library; ruled out per Constitution Principle VI.
- `sharp` — Vercel cross-platform binary footgun; SVG conversion is a secondary use case.
- Headless browser (Puppeteer/Playwright) — Far too heavy; violates Principle VI.
- `vega-lite` — Viable but ~3 MB dependency for three charts; QuickChart is simpler.

**API pattern**:
```ts
async function callQuickChart(config: object, width: number, height: number): Promise<Buffer> {
  const response = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart: config, width, height, format: 'png', backgroundColor: '#FFFFFF' }),
  });
  if (!response.ok) throw new Error(`QuickChart error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
```

**Chart.js config examples**:

Area chart (daily trend):
```ts
{
  type: 'line',
  data: {
    labels: metrics.map(m => m.date),
    datasets: [{ data: metrics.map(m => m.sessions), fill: true,
      borderColor: '#5E96C7', backgroundColor: 'rgba(94,150,199,0.15)',
      pointRadius: 3, tension: 0.3 }]
  },
  options: { plugins: { legend: { display: false } }, scales: { ... } }
}
```

Horizontal bar chart (sources / pages):
```ts
{
  type: 'bar',
  data: {
    labels: items.map(i => i.label),
    datasets: [{ data: items.map(i => i.value),
      backgroundColor: '#5E96C7', borderRadius: 4 }]
  },
  options: { indexAxis: 'y', plugins: { legend: { display: false } } }
}
```

---

## Decision 3: CID Attachment Bug Fix (Critical)

**Decision**: Replace the existing `headers: { 'Content-ID': ... }` pattern with `content_id` field on the attachment object, and update `EmailAttachment` type accordingly.

**Context**: The current implementation in `src/lib/templates.ts` and `src/lib/email.ts` passes:
```ts
{ filename: 'banner_image.png', content: Buffer, headers: { 'Content-ID': '<banner_image.png>' } }
```
The Resend SDK's `Attachment` interface (`resend@3.5.0`) has **no `headers` field** — the SDK is a thin JSON pass-through and silently drops unknown fields. This means the banner image in real Resend-sent emails is currently attached as a regular (non-inline) file attachment, not embedded inline. The email preview appears correct only because `test-email-preview.ts` base64-inlines all CID references before writing to the browser preview file.

**Correct pattern** (per Resend changelog `embed-images-using-cid`, released August 14, 2025):
```ts
{
  filename: 'banner_image.png',
  content: buffer.toString('base64'),   // base64 string recommended (Buffer JSON-serialises as object)
  content_type: 'image/png',
  content_id: 'banner_image.png',       // matches cid:banner_image.png in HTML; no angle brackets
}
```

**Type fix**: `EmailAttachment` must be updated to replace `headers?: { 'Content-ID': string }` with `content_id?: string` and add `content_type?: string`.

**Type cast required**: `resend@3.5.0` TypeScript types do not include `content_id` on `Attachment`. A cast to `unknown as Resend.Attachment` (or `as any`) is needed in `email.ts` until Resend updates their type definitions.

**No chart preview impact**: `test-email-preview.ts` uses base64 inlining (`.replaceAll('cid:X', 'data:image/png;base64,...')`) which works regardless of how the attachment is declared — so the preview continues to work after this fix.

---

## Decision 4: Template Architecture (Charts Above Tables)

**Decision**: Replace the generic bottom-level `charts: Array<{ title, description, image }>` prop with three optional per-section props: `dailyChart?: string`, `sourcesChart?: string`, `pagesChart?: string`.

**Rationale**: The spec requires charts to appear immediately above their corresponding data tables (FR-007). The current generic `charts[]` array renders all charts at the bottom, after all tables. Restructuring to explicit per-section props:
- Makes the template declarative and self-documenting
- Allows each chart to be conditionally rendered alongside its table
- The `ChartCard` component is reused as-is for each section
- The old `charts[]` prop is removed (was placeholder code, never populated in production)

---

## Decision 5: Chart CID Naming Convention

**Decision**: Use short, stable CID identifiers without file extensions.

| Chart | `content_id` | HTML reference | Filename |
|-------|-------------|----------------|----------|
| Banner | `banner_image.png` | `cid:banner_image.png` | `banner_image.png` |
| Daily trend | `chart_daily` | `cid:chart_daily` | `chart_daily.png` |
| Top sources | `chart_sources` | `cid:chart_sources` | `chart_sources.png` |
| Top pages | `chart_pages` | `cid:chart_pages` | `chart_pages.png` |

Note: Banner keeps its existing ID to avoid changing the Banner component's `src` reference.

---

## Decision 6: Graceful Fallback Strategy

**Decision**: Wrap each chart generation call in an independent `try/catch`. On failure, the chart attachment is omitted and `undefined` is passed for that chart's prop — the template renders only the data table for that section.

**Rationale**: FR-010 requires chart failure to not block email delivery. Generating three charts independently (rather than in a single function) also means one failure does not cascade.

---

## No Schema Changes

No database changes are required. All chart data comes from the existing `AnalyticsReport` payload that is already fetched from GA4.

---

## Constitution Compliance

| Principle | Impact | Status |
|-----------|--------|--------|
| I (Event-Driven) | No new workflows; charts are generated inside existing `renderAnalyticsReportEmail` step | ✓ Compliant |
| II (Multi-Env) | Charts generated in all environments; `EMAIL_MODE=mock` skips actual Resend send but templates.ts still renders (no change needed) | ✓ Compliant |
| III (Multi-Tenant) | Chart generation is per-call, data scoped to the client's GA4 report | ✓ Compliant |
| IV (Observability) | `src/lib/charts.ts` errors are caught and logged per chart; email step outcome unchanged | ✓ Compliant |
| VI (Minimal Infra) | No new npm dependencies; QuickChart called via built-in `fetch()`. No new services self-hosted. | ✓ Compliant |
