// T028 / T017: templates module unit tests

const mockReadFile = vi.hoisted(() => vi.fn());
const mockRender = vi.hoisted(() => vi.fn());
const mockGenerateDailyTrendChart = vi.hoisted(() => vi.fn());
const mockGenerateTopSourcesChart = vi.hoisted(() => vi.fn());
const mockGenerateTopPagesChart = vi.hoisted(() => vi.fn());
const mockAnalyticsReportEmailFn = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('@react-email/render', () => ({
  render: mockRender,
}));

// config must be mocked first to prevent throw-at-import from buildConfig()
vi.mock('../../../src/lib/config', () => ({
  config: {
    env: 'development',
    emailMode: 'mock',
    testEmail: null,
    resendApiKey: null,
    resendFrom: 'no-reply@test.local',
    databaseUrl: 'postgresql://mock',
    ga4CredentialsJson: null,
  },
}));

vi.mock('../../../src/lib/charts', () => ({
  generateDailyTrendChart: mockGenerateDailyTrendChart,
  generateTopSourcesChart: mockGenerateTopSourcesChart,
  generateTopPagesChart: mockGenerateTopPagesChart,
}));

vi.mock('../../../src/emails/templates/analytics-report-v1', () => ({
  default: mockAnalyticsReportEmailFn,
}));

import { renderFormNotificationEmail, renderAnalyticsReportEmail } from '../../../src/lib/templates';
import type { FormSubmittedPayload, ClientRow, AnalyticsReport, ResolvedPeriod } from '../../../src/types/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockBannerBuffer = Buffer.from('fake-png-data');
const mockChartBuffer = Buffer.from('fake-chart-png');
const mockHtml = '<html><body>mock email content</body></html>';

const mockClient: ClientRow = {
  id: 'acme',
  name: 'Acme Corp',
  email: 'hello@acmecorp.com',
  ga4_property_id: null,
  active: true,
  settings: {},
  created_at: new Date(),
};

const mockPeriod: ResolvedPeriod = {
  start: '2026-02-16',
  end: '2026-02-22',
  label: 'Feb 16 – Feb 22, 2026',
  preset: 'last_week',
};

const mockReport: AnalyticsReport = {
  sessions: 4820,
  activeUsers: 3200,
  newUsers: 540,
  avgSessionDurationSecs: 185,
  topSources: [
    { source: 'google', sessions: 2100 },
    { source: 'direct', sessions: 1400 },
  ],
  topPages: [
    { path: '/', views: 3000 },
  ],
  dailyMetrics: [
    { date: '2026-02-16', sessions: 680, activeUsers: 450, newUsers: 80 },
  ],
  resolvedPeriod: mockPeriod,
  isMock: false,
};

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockReadFile.mockResolvedValue(mockBannerBuffer);
  mockRender.mockResolvedValue(mockHtml);
  mockGenerateDailyTrendChart.mockResolvedValue(mockChartBuffer);
  mockGenerateTopSourcesChart.mockResolvedValue(mockChartBuffer);
  mockGenerateTopPagesChart.mockResolvedValue(mockChartBuffer);
  mockAnalyticsReportEmailFn.mockReturnValue({ type: 'div', props: {} });
});

// ---------------------------------------------------------------------------
// renderFormNotificationEmail
// ---------------------------------------------------------------------------

describe('renderFormNotificationEmail', () => {
  const payload: FormSubmittedPayload = {
    clientId: 'acme',
    submitterName: 'Jane Smith',
    submitterEmail: 'jane@example.com',
    submitterMessage: 'Hello, I would like a quote.',
    formId: 'Contact Form',
  };

  it('returns a subject containing the client name', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.subject).toContain('Acme Corp');
  });

  it('returns a non-empty html string from render()', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(typeof result.html).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
  });

  it('returns one attachment with the banner filename and content_id', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('banner_image.png');
    expect(result.attachments[0].content_id).toBe('banner_image.png');
  });

  it('banner attachment has no headers field', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect((result.attachments[0] as any).headers).toBeUndefined();
  });

  it('banner attachment content is a base64 string', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    const expectedBase64 = mockBannerBuffer.toString('base64');
    expect(result.attachments[0].content).toBe(expectedBase64);
  });

  it('reads the banner from assets/banner_image.png', async () => {
    await renderFormNotificationEmail(payload, mockClient);
    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('banner_image.png'));
  });

  it('includes formId in the subject when provided', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.subject).toContain('Contact Form');
  });

  it('generates a subject without formId when formId is absent', async () => {
    const payloadNoForm: FormSubmittedPayload = {
      clientId: 'acme',
      submitterName: 'Jane Smith',
      submitterEmail: 'jane@example.com',
      submitterMessage: 'Hello.',
    };
    const result = await renderFormNotificationEmail(payloadNoForm, mockClient);
    expect(result.subject).toContain('Acme Corp');
    expect(result.subject).not.toContain('undefined');
  });
});

// ---------------------------------------------------------------------------
// renderAnalyticsReportEmail
// ---------------------------------------------------------------------------

describe('renderAnalyticsReportEmail', () => {
  it('returns a subject containing the period label', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.subject).toContain('Feb 16 – Feb 22, 2026');
  });

  it('returns a non-empty html string from render()', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(typeof result.html).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
  });

  it('returns 4 attachments (banner + 3 charts) when all chart data is present', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.attachments).toHaveLength(4);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_sources.png');
    expect(filenames).toContain('chart_pages.png');
  });

  it('omits sources chart when topSources is empty (graceful fallback)', async () => {
    // Real implementation throws for empty array — replicate that in the mock
    mockGenerateTopSourcesChart.mockRejectedValue(new Error('sources array is empty'));
    const reportNoSources: AnalyticsReport = { ...mockReport, topSources: [] };
    const result = await renderAnalyticsReportEmail(reportNoSources, mockClient, mockPeriod);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).not.toContain('chart_sources.png');
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_pages.png');
  });

  it('returns 3 attachments when one chart fn throws', async () => {
    mockGenerateTopSourcesChart.mockRejectedValue(new Error('QuickChart 500'));
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.attachments).toHaveLength(3);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).not.toContain('chart_sources.png');
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_pages.png');
  });

  it('banner attachment has content_id and no headers field', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    const banner = result.attachments.find(a => a.filename === 'banner_image.png')!;
    expect(banner.content_id).toBe('banner_image.png');
    expect((banner as any).headers).toBeUndefined();
  });

  it('chart attachments have correct content_id values', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    const daily = result.attachments.find(a => a.filename === 'chart_daily.png')!;
    const sources = result.attachments.find(a => a.filename === 'chart_sources.png')!;
    const pages = result.attachments.find(a => a.filename === 'chart_pages.png')!;
    expect(daily.content_id).toBe('chart_daily');
    expect(sources.content_id).toBe('chart_sources');
    expect(pages.content_id).toBe('chart_pages');
  });

  it('returns a previewText containing the session count', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.previewText).toBeDefined();
    expect(result.previewText).toContain('4,820');
  });

  it('reads the banner from assets/banner_image.png', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('banner_image.png'));
  });

  it('calls render() once with a valid React element', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(mockRender).toHaveBeenCalledOnce();
    const [element] = mockRender.mock.calls[0];
    expect(element).toBeDefined();
    expect(element.type).toBeDefined();
  });

  it('formats ISO date (YYYY-MM-DD) to MM/DD/YYYY in dailyMetrics passed to template', async () => {
    const report = { ...mockReport, dailyMetrics: [{ date: '2026-02-16', sessions: 100, activeUsers: 80, newUsers: 20 }] };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.dailyMetrics[0].date).toBe('02/16/2026');
  });

  it('formats GA4 compact date (YYYYMMDD) to MM/DD/YYYY in dailyMetrics passed to template', async () => {
    const report = { ...mockReport, dailyMetrics: [{ date: '20260201', sessions: 100, activeUsers: 80, newUsers: 20 }] };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.dailyMetrics[0].date).toBe('02/01/2026');
  });
});

// ---------------------------------------------------------------------------
// renderAnalyticsReportEmail — historical metric building
// ---------------------------------------------------------------------------
// Verifies that buildMetric() correctly derives bars, changePhrase,
// changeDirection, periodLabel, and comparisonLabel from historicalPeriods.
// Assertions inspect the props passed directly to AnalyticsReportV1Email.
// ---------------------------------------------------------------------------

describe('renderAnalyticsReportEmail — historical metric building', () => {
  // Shared prior-period data — 3 weeks of increasing traffic
  const threePriors = [
    { periodLabel: 'Jan 26', sessions: 3000, activeUsers: 2000, newUsers: 400, avgSessionDurationSecs: 160 },
    { periodLabel: 'Feb 2',  sessions: 3500, activeUsers: 2400, newUsers: 450, avgSessionDurationSecs: 165 },
    { periodLabel: 'Feb 9',  sessions: 4000, activeUsers: 2800, newUsers: 500, avgSessionDurationSecs: 170 },
  ];

  // ---------------------------------------------------------------------------
  describe('no historical data — fallback mode', () => {
    it('sessions metric has no bars when historicalPeriods is absent', async () => {
      await renderAnalyticsReportEmail({ ...mockReport, historicalPeriods: undefined }, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toBeUndefined();
      expect(props.sessions.changePhrase).toBeUndefined();
    });

    it('sessions metric still carries value, label, and sublabel', async () => {
      await renderAnalyticsReportEmail({ ...mockReport, historicalPeriods: undefined }, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.value).toBe('4,820');
      expect(props.sessions.label).toBe('Website Visits');
      expect(props.sessions.sublabel).toBe('Sessions');
    });

    it('empty historicalPeriods array also triggers fallback', async () => {
      await renderAnalyticsReportEmail({ ...mockReport, historicalPeriods: [] }, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('1 prior period', () => {
    it('sessions metric has exactly 2 bars (1 prior + 1 current)', async () => {
      const report = { ...mockReport, historicalPeriods: [threePriors[2]] }; // Feb 9 only
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toHaveLength(2);
      expect(props.sessions.bars[0].isCurrent).toBe(false);
      expect(props.sessions.bars[1].isCurrent).toBe(true);
    });

    it('comparisonLabel uses singular "the previous week" for last_week preset', async () => {
      const report = { ...mockReport, historicalPeriods: [threePriors[2]] };
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous week');
    });

    it('prior bar carries the periodLabel from historicalPeriods', async () => {
      const report = { ...mockReport, historicalPeriods: [threePriors[2]] };
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars[0].label).toBe('Feb 9');
    });
  });

  // ---------------------------------------------------------------------------
  describe('2 prior periods', () => {
    it('sessions metric has exactly 3 bars (2 prior + 1 current)', async () => {
      const report = { ...mockReport, historicalPeriods: threePriors.slice(1) }; // Feb 2, Feb 9
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toHaveLength(3);
    });

    it('comparisonLabel uses "the previous 2 weeks" for last_week preset', async () => {
      const report = { ...mockReport, historicalPeriods: threePriors.slice(1) };
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous 2 weeks');
    });
  });

  // ---------------------------------------------------------------------------
  describe('3 prior periods — upward trend', () => {
    // avg sessions = (3000+3500+4000)/3 = 3500, current = 4820
    // ratio ≈ 0.377 → 38% up
    const reportWith3 = { ...mockReport, historicalPeriods: threePriors };

    it('sessions metric has exactly 4 bars (3 prior + 1 current)', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toHaveLength(4);
    });

    it('current bar is last and marked isCurrent:true', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      const bars = props.sessions.bars;
      expect(bars[bars.length - 1].isCurrent).toBe(true);
      bars.slice(0, -1).forEach((b: any) => expect(b.isCurrent).toBe(false));
    });

    it('changeDirection is "up"', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changeDirection).toBe('up');
    });

    it('changePhrase contains "more sessions"', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changePhrase).toMatch(/more sessions$/);
    });

    it('comparisonLabel is "the previous 3 weeks" for last_week preset', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous 3 weeks');
    });

    it('periodLabel matches the period label string', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.periodLabel).toBe('Feb 16 – Feb 22, 2026');
    });
  });

  // ---------------------------------------------------------------------------
  describe('3 prior periods — downward trend', () => {
    // sessions current = 2000, avg = 3500 → 43% down
    const reportDown = {
      ...mockReport,
      sessions: 2000,
      historicalPeriods: threePriors,
    };

    it('changeDirection is "down"', async () => {
      await renderAnalyticsReportEmail(reportDown, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changeDirection).toBe('down');
    });

    it('changePhrase contains "fewer sessions"', async () => {
      await renderAnalyticsReportEmail(reportDown, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changePhrase).toMatch(/fewer sessions$/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('3 prior periods — neutral trend', () => {
    // ratio = 35/3500 = 0.01 exactly → not > 0.01, so neutral
    const reportNeutral = {
      ...mockReport,
      sessions: 3535,
      historicalPeriods: [
        { periodLabel: 'Jan 26', sessions: 3500, activeUsers: 2000, newUsers: 400, avgSessionDurationSecs: 160 },
        { periodLabel: 'Feb 2',  sessions: 3500, activeUsers: 2400, newUsers: 450, avgSessionDurationSecs: 165 },
        { periodLabel: 'Feb 9',  sessions: 3500, activeUsers: 2800, newUsers: 500, avgSessionDurationSecs: 170 },
      ],
    };

    it('changeDirection is "neutral"', async () => {
      await renderAnalyticsReportEmail(reportNeutral, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changeDirection).toBe('neutral');
    });

    it('changePhrase uses "consistent sessions" for neutral direction', async () => {
      await renderAnalyticsReportEmail(reportNeutral, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.changePhrase).toBe('consistent sessions');
    });
  });

  // ---------------------------------------------------------------------------
  describe('preset-based comparisonLabel wording', () => {
    const report3 = { ...mockReport, historicalPeriods: threePriors };

    it('last_month + 3 periods → "the previous 3 months"', async () => {
      const monthPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'last_month' };
      await renderAnalyticsReportEmail(report3, mockClient, monthPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous 3 months');
    });

    it('last_30_days + 1 period → "the previous 30-day period"', async () => {
      const thirtyPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'last_30_days' };
      const report1 = { ...mockReport, historicalPeriods: [threePriors[0]] };
      await renderAnalyticsReportEmail(report1, mockClient, thirtyPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous 30-day period');
    });

    it('last_30_days + 3 periods → "the previous 3 30-day periods"', async () => {
      const thirtyPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'last_30_days' };
      await renderAnalyticsReportEmail(report3, mockClient, thirtyPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.comparisonLabel).toBe('the previous 3 30-day periods');
    });
  });

  // ---------------------------------------------------------------------------
  describe('metric-specific labels, sublabels, and changePhrase language', () => {
    const reportWith3 = { ...mockReport, historicalPeriods: threePriors };

    it('sessions → label "Website Visits", sublabel "Sessions", phrase ends with "sessions"', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.label).toBe('Website Visits');
      expect(props.sessions.sublabel).toBe('Sessions');
      expect(props.sessions.changePhrase).toMatch(/sessions$/);
    });

    it('avgDuration → label "Avg. Time on Site", sublabel "Avg. Duration", phrase ends with "average sessions"', async () => {
      // avg duration priors = (160+165+170)/3 = 165, current = 185 → 12% longer
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.avgDuration.label).toBe('Avg. Time on Site');
      expect(props.avgDuration.sublabel).toBe('Avg. Duration');
      expect(props.avgDuration.changePhrase).toMatch(/longer average sessions$/);
    });

    it('activeUsers → label "Total Visitors", sublabel "Active Users", phrase ends with "active users"', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.activeUsers.label).toBe('Total Visitors');
      expect(props.activeUsers.sublabel).toBe('Active Users');
      expect(props.activeUsers.changePhrase).toMatch(/active users$/);
    });

    it('newUsers → label "First-Time Visitors", sublabel "New Users", phrase ends with "new users"', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.newUsers.label).toBe('First-Time Visitors');
      expect(props.newUsers.sublabel).toBe('New Users');
      expect(props.newUsers.changePhrase).toMatch(/new users$/);
    });

    it('avgDuration downward trend → "shorter average sessions"', async () => {
      // avg duration = 165, current = 130 → shorter
      const reportDurationDown = { ...mockReport, avgSessionDurationSecs: 130, historicalPeriods: threePriors };
      await renderAnalyticsReportEmail(reportDurationDown, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.avgDuration.changePhrase).toMatch(/shorter average sessions$/);
      expect(props.avgDuration.changeDirection).toBe('down');
    });

    it('each metric has 4 bars when 3 prior periods are provided', async () => {
      await renderAnalyticsReportEmail(reportWith3, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars).toHaveLength(4);
      expect(props.avgDuration.bars).toHaveLength(4);
      expect(props.activeUsers.bars).toHaveLength(4);
      expect(props.newUsers.bars).toHaveLength(4);
    });
  });
});
