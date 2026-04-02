import { colors } from '../emails/styles';
import type { DailyMetric } from '../types/index';

// ---------------------------------------------------------------------------
// Layer 1: HTTP transport (private)
// ---------------------------------------------------------------------------

async function callQuickChart(chart: object, height: number, width = 760): Promise<Buffer> {
  const res = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 3,
      chart,
      width,
      height,
      format: 'png',
      backgroundColor: colors.surface,
    }),
  });
  if (!res.ok) throw new Error(`QuickChart ${res.status}: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// Fixed fill colors per traffic category — chosen so white labels are readable on all slices
const CATEGORY_COLORS: Record<string, string> = {
  Search:   '#3A6EA5', // accent blue
  Social:   '#5E96C7', // medium blue
  Direct:   '#52525B', // charcoal (textSecondary)
  Email:    '#71717A', // mid gray
  Referral: '#8A8A95', // muted gray
  Other:    '#A1A1AA', // light gray — unattributed / unlisted sources
};
const CATEGORY_COLOR_FALLBACK = '#8A8A95';

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
            borderColor: colors.border,
            backgroundColor: colors.shading,
            pointRadius: 2,
            pointBackgroundColor: colors.border,
            tension: 0.3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        layout: { padding: { top: 24 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: colors.textSecondary,
            font: { size: 10 },
            formatter: 'function(value) { var p = Math.round(value).toString().split(""); var o = ""; for (var i = 0; i < p.length; i++) { if (i > 0 && (p.length - i) % 3 === 0) o += ","; o += p[i]; } return o; }',
          },
        },
        scales: {
          x: {
            ticks: { color: colors.textMuted, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            display: false,
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
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...(isHorizontal
          ? { indexAxis: 'y', layout: { padding: { right: 50 } } }
          : { layout: { padding: { top: 24 } } }),
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: colors.textSecondary,
            font: { size: 10 },
            formatter: 'function(value) { var p = Math.round(value).toString().split(""); var o = ""; for (var i = 0; i < p.length; i++) { if (i > 0 && (p.length - i) % 3 === 0) o += ","; o += p[i]; } return o; }',
          },
        },
        scales: {
          x: {
            display: isHorizontal ? false : true,
            ticks: { color: colors.textPrimary, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            display: isHorizontal ? true : false,
            ticks: { color: colors.textPrimary, font: { size: 11 } },
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

/** Generates a single half-doughnut gauge arc — no labels inside the image.
 *  Percentage and category name are rendered as HTML in the email template. */
async function generateCategoryGauge(sessions: number, totalSessions: number): Promise<Buffer> {
  const pct = totalSessions > 0 ? Math.round((sessions / totalSessions) * 100) : 0;
  const remaining = 100 - pct;

  return callQuickChart(
    {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: [pct, remaining],
            backgroundColor: [colors.textMuted, colors.border],
            borderWidth: 0,
            borderRadius: 6,
          },
        ],
      },
      options: {
        circumference: 180,
        rotation: -90,
        cutout: '65%',
        layout: { padding: 12 },
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
        },
      },
    },
    120,
    220,
  );
}

/** Renders one gauge arc per top-3 traffic category (no labels — rendered in HTML). */
export async function generateTopSourcesGauges(
  categories: Array<{ label: string; sessions: number }>,
  totalSessions: number,
): Promise<Buffer[]> {
  if (categories.length === 0) throw new Error('generateTopSourcesGauges: sources array is empty');
  const top3 = categories.slice(0, 3);
  return Promise.all(top3.map((c) => generateCategoryGauge(c.sessions, totalSessions)));
}

export async function generateTopPagesChart(pages: Array<{ label: string; views: number }>): Promise<Buffer> {
  if (pages.length === 0) throw new Error('generateTopPagesChart: pages array is empty');
  const labels = pages.map((p) =>
    p.label.length > 30 ? p.label.slice(0, 29) + '\u2026' : p.label,
  );
  const values = pages.map((p) => p.views);
  return generateBarChart(labels, values);
}
