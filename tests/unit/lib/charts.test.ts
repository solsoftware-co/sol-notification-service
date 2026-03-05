// T016: charts module unit tests

import { colors } from '../../../src/emails/styles';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  generateDailyTrendChart,
  generateTopSourcesChart,
  generateTopPagesChart,
} from '../../../src/lib/charts';
import type { DailyMetric, TrafficSource, TopPage } from '../../../src/types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchOk(data: Uint8Array = new Uint8Array([1, 2, 3])): void {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => data.buffer,
  });
}

function captureChartConfig(): object {
  const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
  return body.chart;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const dailyMetrics: DailyMetric[] = [
  { date: '2026-02-23', sessions: 1540, activeUsers: 1120, newUsers: 180 },
  { date: '2026-02-24', sessions: 1820, activeUsers: 1310, newUsers: 210 },
  { date: '2026-02-25', sessions: 1920, activeUsers: 1390, newUsers: 195 },
];

const sources: TrafficSource[] = [
  { source: 'google', sessions: 4820 },
  { source: 'direct', sessions: 3210 },
  { source: 'a-very-long-source-name-that-exceeds-thirty-characters', sessions: 500 },
];

const pages: TopPage[] = [
  { path: '/', views: 5430 },
  { path: '/services', views: 3120 },
  { path: '/a-very-long-page-path-that-exceeds-thirty-characters', views: 100 },
];

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  makeFetchOk();
});

// ---------------------------------------------------------------------------
// generateDailyTrendChart
// ---------------------------------------------------------------------------

describe('generateDailyTrendChart', () => {
  it('sends type: line config to QuickChart', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.type).toBe('line');
  });

  it('maps dates to M/D labels without leading zeros (ISO YYYY-MM-DD format)', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.labels).toEqual(['2/23', '2/24', '2/25']);
  });

  it('maps YYYYMMDD dates (GA4 API format) to M/D labels without leading zeros', async () => {
    const ga4Metrics: DailyMetric[] = [
      { date: '20260201', sessions: 100, activeUsers: 80, newUsers: 20 },
      { date: '20260215', sessions: 200, activeUsers: 160, newUsers: 40 },
    ];
    await generateDailyTrendChart(ga4Metrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.labels).toEqual(['2/1', '2/15']);
  });

  it('maps sessions to dataset values', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].data).toEqual([1540, 1820, 1920]);
  });

  it('sends fill: true for area chart', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].fill).toBe(true);
  });

  it('uses brand accent colour for borderColor', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].borderColor).toBe(colors.accent);
  });

  it('passes backgroundColor: colors.surface in the QuickChart request body', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.backgroundColor).toBe(colors.surface);
  });

  it('returns a Buffer from the response arrayBuffer', async () => {
    const result = await generateDailyTrendChart(dailyMetrics);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('throws when metrics array is empty', async () => {
    await expect(generateDailyTrendChart([])).rejects.toThrow('metrics array is empty');
  });

  it('propagates error on non-ok QuickChart response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });
    await expect(generateDailyTrendChart(dailyMetrics)).rejects.toThrow('QuickChart 429');
  });
});

// ---------------------------------------------------------------------------
// generateTopSourcesChart
// ---------------------------------------------------------------------------

describe('generateTopSourcesChart', () => {
  it('sends type: bar config to QuickChart', async () => {
    await generateTopSourcesChart(sources);
    const chart = captureChartConfig() as any;
    expect(chart.type).toBe('bar');
  });

  it('does not set indexAxis when fewer than 8 sources (vertical bars)', async () => {
    await generateTopSourcesChart(sources); // fixture has 3 sources
    const chart = captureChartConfig() as any;
    expect(chart.options.indexAxis).toBeUndefined();
  });

  it('sets indexAxis: y when 8 or more sources (horizontal bars)', async () => {
    const manySources: TrafficSource[] = Array.from({ length: 8 }, (_, i) => ({
      source: `source-${i}`,
      sessions: 100 - i,
    }));
    await generateTopSourcesChart(manySources);
    const chart = captureChartConfig() as any;
    expect(chart.options.indexAxis).toBe('y');
  });

  it('maps source names to labels', async () => {
    await generateTopSourcesChart(sources);
    const chart = captureChartConfig() as any;
    expect(chart.data.labels[0]).toBe('google');
    expect(chart.data.labels[1]).toBe('direct');
  });

  it('truncates labels longer than 30 chars with ellipsis', async () => {
    await generateTopSourcesChart(sources);
    const chart = captureChartConfig() as any;
    const truncated: string = chart.data.labels[2];
    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(truncated.endsWith('\u2026')).toBe(true);
  });

  it('maps sessions to dataset values', async () => {
    await generateTopSourcesChart(sources);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].data[0]).toBe(4820);
  });

  it('uses brand accent colour for backgroundColor', async () => {
    await generateTopSourcesChart(sources);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].backgroundColor).toBe(colors.accent);
  });

  it('passes backgroundColor: colors.surface in the QuickChart request body', async () => {
    await generateTopSourcesChart(sources);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.backgroundColor).toBe(colors.surface);
  });

  it('throws when sources array is empty', async () => {
    await expect(generateTopSourcesChart([])).rejects.toThrow('sources array is empty');
  });

  it('propagates error on non-ok QuickChart response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(generateTopSourcesChart(sources)).rejects.toThrow('QuickChart 500');
  });
});

// ---------------------------------------------------------------------------
// generateTopPagesChart
// ---------------------------------------------------------------------------

describe('generateTopPagesChart', () => {
  it('sends type: bar config to QuickChart', async () => {
    await generateTopPagesChart(pages);
    const chart = captureChartConfig() as any;
    expect(chart.type).toBe('bar');
  });

  it('does not set indexAxis when fewer than 8 pages (vertical bars)', async () => {
    await generateTopPagesChart(pages); // fixture has 3 pages
    const chart = captureChartConfig() as any;
    expect(chart.options.indexAxis).toBeUndefined();
  });

  it('maps page paths to labels', async () => {
    await generateTopPagesChart(pages);
    const chart = captureChartConfig() as any;
    expect(chart.data.labels[0]).toBe('/');
    expect(chart.data.labels[1]).toBe('/services');
  });

  it('truncates page path labels longer than 30 chars with ellipsis', async () => {
    await generateTopPagesChart(pages);
    const chart = captureChartConfig() as any;
    const truncated: string = chart.data.labels[2];
    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(truncated.endsWith('\u2026')).toBe(true);
  });

  it('maps views to dataset values', async () => {
    await generateTopPagesChart(pages);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].data[0]).toBe(5430);
  });

  it('throws when pages array is empty', async () => {
    await expect(generateTopPagesChart([])).rejects.toThrow('pages array is empty');
  });

  it('propagates error on non-ok QuickChart response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(generateTopPagesChart(pages)).rejects.toThrow('QuickChart 503');
  });
});
