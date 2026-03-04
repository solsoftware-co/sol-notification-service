# Quickstart: Analytics Email Charts

**Feature**: 007-analytics-email-charts
**Date**: 2026-03-04

---

## Running the Email Preview

After implementation, generate and inspect all chart types with:

```bash
npm run email:preview
```

This renders both the inquiry email and the analytics report email (with all three charts embedded) and opens them in your browser. Charts are base64-inlined for browser display — the same images that would be CID-attached in a real send.

Expected output:
```
Inquiry preview written → .email-preview/inquiry.html
Analytics preview written → .email-preview/analytics.html
```

The analytics preview should show:
1. Banner image at top
2. Four stat cards (Sessions, Avg Duration, Active Users, New Users)
3. **Area chart** above the Daily Breakdown table
4. **Horizontal bar chart** above the Top Sources table
5. **Horizontal bar chart** above the Top Pages table

---

## Integration Scenarios

### Scenario 1: Full report with all charts present

```ts
import { renderAnalyticsReportEmail } from './src/lib/templates';

const result = await renderAnalyticsReportEmail(report, client, period);
// result.attachments will include: banner + up to 3 chart PNGs
// result.html will reference: cid:chart_daily, cid:chart_sources, cid:chart_pages
console.log('Attachments:', result.attachments.map(a => a.filename));
// → ['banner_image.png', 'chart_daily.png', 'chart_sources.png', 'chart_pages.png']
```

### Scenario 2: Report with no source data (graceful omission)

```ts
const reportNoSources = { ...report, topSources: [] };
const result = await renderAnalyticsReportEmail(reportNoSources, client, period);
// Sources chart is omitted; only banner + daily + pages chart attached
console.log('Attachments:', result.attachments.map(a => a.filename));
// → ['banner_image.png', 'chart_daily.png', 'chart_pages.png']
```

### Scenario 3: Chart generation failure (graceful fallback)

Chart errors are caught internally. If `generateDailyTrendChart` throws:
- `dailyChart` prop is `undefined`
- The Daily Breakdown section renders with table only (no broken image)
- Other charts are unaffected
- The email is still sent

### Scenario 4: Verifying brand colours in a chart

```ts
import { generateTopSourcesChart } from './src/lib/charts';
import { colors } from './src/emails/styles';

const pngBuffer = await generateTopSourcesChart([
  { source: 'google', sessions: 4820 },
  { source: 'direct', sessions: 3210 },
]);
// Write to disk for visual inspection
import { writeFileSync } from 'node:fs';
writeFileSync('./debug_sources_chart.png', pngBuffer);
```

### Scenario 5: Testing mock data preview (existing preview script)

The preview script in `scripts/test-email-preview.ts` uses the same mock data as before and now also generates charts. No additional setup required. The `inlineImages()` function has been updated to replace all CID references (banner + all charts) with base64 data URIs.

---

## Checking Chart Output Dimensions

Charts render at 760 × dynamic-height px. To verify:

```ts
import { Resvg } from '@resvg/resvg-js';

const svg = buildDailyTrendSvg(metrics); // internal function
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 760 } });
const rendered = resvg.render();
console.log(rendered.width, rendered.height); // 760 × 200
```

---

## Environment Behaviour

| Mode | `EMAIL_MODE` | Chart generation | Email delivery |
|------|-------------|-----------------|----------------|
| Dev | `mock` | Charts generated | HTML logged to console; `.email-preview/` written if preview script is run |
| Preview | `test` | Charts generated | Email sent to `TEST_EMAIL` address with `[TEST: ...]` subject prefix |
| Production | `live` | Charts generated | Email sent to real client address with CID-embedded charts |
