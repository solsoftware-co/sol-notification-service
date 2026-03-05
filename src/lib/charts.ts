import { colors } from '../emails/styles';
import type { DailyMetric, TrafficSource, TopPage } from '../types/index';

// ---------------------------------------------------------------------------
// Layer 1: HTTP transport (private)
// ---------------------------------------------------------------------------

async function callQuickChart(chart: object, height: number): Promise<Buffer> {
  const res = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 3,
      chart,
      width: 760,
      height,
      format: 'png',
      backgroundColor: colors.surface,
    }),
  });
  if (!res.ok) throw new Error(`QuickChart ${res.status}: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Layer 2: Branded chart config builders (private)
// ---------------------------------------------------------------------------

async function generateAreaChart(
  labels: string[],
  values: number[],
  height = 220,
): Promise<Buffer> {
  return callQuickChart(
    {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            fill: true,
            borderColor: colors.accent,
            backgroundColor: colors.accentShading,
            pointRadius: 4,
            pointBackgroundColor: colors.accent,
            tension: 0.3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: colors.textSecondary,
            font: { size: 10 },
            formatter: 'function(value) { return value.toLocaleString("en-US"); }',
          },
        },
        scales: {
          x: {
            ticks: { color: colors.textMuted, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: { color: colors.textMuted, font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    },
    height,
  );
}

async function generateBarChart(
  labels: string[],
  values: number[],
  height?: number,
): Promise<Buffer> {
  const isHorizontal = labels.length >= 8;
  const h = height ?? (isHorizontal ? labels.length * 40 + 40 : 220);
  return callQuickChart(
    {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors.accent,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...(isHorizontal ? { indexAxis: 'y' } : { layout: { padding: { top: 24 } } }),
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: colors.textSecondary,
            font: { size: 10 },
            formatter: 'function(value) { return value.toLocaleString("en-US"); }',
          },
        },
        scales: {
          x: {
            ticks: { color: colors.textMuted, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: { color: colors.textSecondary, font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    },
    h,
  );
}

// ---------------------------------------------------------------------------
// Layer 3: Domain-specific public exports
// ---------------------------------------------------------------------------

export async function generateDailyTrendChart(metrics: DailyMetric[]): Promise<Buffer> {
  if (metrics.length === 0) throw new Error('generateDailyTrendChart: metrics array is empty');
  const labels = metrics.map((m) => {
    // GA4 returns "YYYYMMDD"; ISO format is "YYYY-MM-DD" — handle both
    const s = m.date.includes('-') ? m.date : `${m.date.slice(0, 4)}-${m.date.slice(4, 6)}-${m.date.slice(6, 8)}`;
    const [, mm, dd] = s.split('-');
    return `${parseInt(mm)}/${parseInt(dd)}`; // → "M/D"
  });
  const values = metrics.map((m) => m.sessions);
  return generateAreaChart(labels, values);
}

export async function generateTopSourcesChart(sources: TrafficSource[]): Promise<Buffer> {
  if (sources.length === 0) throw new Error('generateTopSourcesChart: sources array is empty');
  const labels = sources.map((s) =>
    s.source.length > 30 ? s.source.slice(0, 29) + '\u2026' : s.source,
  );
  const values = sources.map((s) => s.sessions);
  return generateBarChart(labels, values);
}

export async function generateTopPagesChart(pages: TopPage[]): Promise<Buffer> {
  if (pages.length === 0) throw new Error('generateTopPagesChart: pages array is empty');
  const labels = pages.map((p) =>
    p.path.length > 30 ? p.path.slice(0, 29) + '\u2026' : p.path,
  );
  const values = pages.map((p) => p.views);
  return generateBarChart(labels, values);
}
