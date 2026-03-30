// T016: charts module unit tests

import { colors } from '../../../src/emails/styles';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  generateDailyTrendChart,
  generateTopSourcesGauges,
  generateTopPagesChart,
} from '../../../src/lib/charts';
import type { DailyMetric } from '../../../src/types/index';

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

const sources: Array<{ label: string; sessions: number }> = [
  { label: 'Search', sessions: 4820 },
  { label: 'Social', sessions: 3210 },
  { label: 'Direct', sessions: 1400 },
];

const pages: Array<{ label: string; views: number }> = [
  { label: 'Home', views: 5430 },
  { label: 'Services', views: 3120 },
  { label: 'A Very Long Page Name That Exceeds Thirty Characters', views: 100 },
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

  it('uses border colour for borderColor (muted line style)', async () => {
    await generateDailyTrendChart(dailyMetrics);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].borderColor).toBe(colors.border);
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
// generateTopSourcesGauges
// ---------------------------------------------------------------------------

describe('generateTopSourcesGauges', () => {
  it('returns an array of Buffers — one per category (up to 3)', async () => {
    makeFetchOk();
    makeFetchOk();
    makeFetchOk();
    const results = await generateTopSourcesGauges(sources, 10000);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(3);
    results.forEach(r => expect(Buffer.isBuffer(r)).toBe(true));
  });

  it('caps at 3 gauges even when more categories are supplied', async () => {
    makeFetchOk();
    makeFetchOk();
    makeFetchOk();
    const many = [
      { label: 'Search',   sessions: 4000 },
      { label: 'Social',   sessions: 2000 },
      { label: 'Direct',   sessions: 1500 },
      { label: 'Email',    sessions: 800  },
      { label: 'Referral', sessions: 300  },
    ];
    const results = await generateTopSourcesGauges(many, 10000);
    expect(results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('sends type: doughnut config to QuickChart', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.type).toBe('doughnut');
  });

  it('sets circumference: 180 and rotation: -90 for half-circle gauge', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.options.circumference).toBe(180);
    expect(chart.options.rotation).toBe(-90);
  });

  it('fills arc proportionally — category sessions / totalSessions rounded to nearest %', async () => {
    makeFetchOk();
    // 4820 / 10000 = 48.2% → rounds to 48
    await generateTopSourcesGauges([{ label: 'Search', sessions: 4820 }], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].data[0]).toBe(48);
    expect(chart.data.datasets[0].data[1]).toBe(52); // remainder
  });

  it('uses colors.currentBar for the filled arc and colors.border for the background arc', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    const bg: string[] = chart.data.datasets[0].backgroundColor;
    expect(bg[0]).toBe(colors.currentBar);
    expect(bg[1]).toBe(colors.border);
  });

  it('applies borderRadius to the dataset for rounded arc ends', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.data.datasets[0].borderRadius).toBeGreaterThan(0);
  });

  it('hides all labels inside the chart image (percentage and name rendered as HTML)', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.options.plugins.datalabels.display).toBe(false);
    expect(chart.options.plugins.title).toBeUndefined();
  });

  it('hides the legend', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const chart = captureChartConfig() as any;
    expect(chart.options.plugins.legend.display).toBe(false);
  });

  it('passes backgroundColor: colors.surface in the QuickChart request body', async () => {
    makeFetchOk();
    await generateTopSourcesGauges([sources[0]], 10000);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.backgroundColor).toBe(colors.surface);
  });

  it('throws when sources array is empty', async () => {
    await expect(generateTopSourcesGauges([], 10000)).rejects.toThrow('sources array is empty');
  });

  it('propagates error on non-ok QuickChart response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(generateTopSourcesGauges(sources, 10000)).rejects.toThrow('QuickChart 500');
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

  it('maps pre-computed labels to chart labels', async () => {
    await generateTopPagesChart(pages);
    const chart = captureChartConfig() as any;
    expect(chart.data.labels[0]).toBe('Home');
    expect(chart.data.labels[1]).toBe('Services');
  });

  it('truncates labels longer than 30 chars with ellipsis', async () => {
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
