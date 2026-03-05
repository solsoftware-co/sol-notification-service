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
            pointRadius: 3,
            tension: 0.3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
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
  const h = height ?? labels.length * 40 + 40;
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
        plugins: { legend: { display: false } },
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
  const labels = metrics.map((m) => m.date.slice(5)); // "YYYY-MM-DD" → "MM-DD"
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
