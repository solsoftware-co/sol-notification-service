// T028 / T017: templates module unit tests

const mockReadFile = vi.hoisted(() => vi.fn());
const mockRender = vi.hoisted(() => vi.fn());
const mockGenerateDailyTrendChart = vi.hoisted(() => vi.fn());
const mockGenerateTopSourcesGauges = vi.hoisted(() => vi.fn());
const mockGenerateTopPagesChart = vi.hoisted(() => vi.fn());
const mockAnalyticsReportEmailFn = vi.hoisted(() => vi.fn());
const mockSalesLeadV1EmailFn = vi.hoisted(() => vi.fn());
const mockBuildAnalyticsExcel = vi.hoisted(() => vi.fn());
const mockBuildExcelFilename = vi.hoisted(() => vi.fn());

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
  generateTopSourcesGauges: mockGenerateTopSourcesGauges,
  generateTopPagesChart: mockGenerateTopPagesChart,
}));

vi.mock('../../../src/emails/templates/analytics-report-v1', () => ({
  default: mockAnalyticsReportEmailFn,
}));

vi.mock('../../../src/emails/templates/sales-lead-v1', () => ({
  default: mockSalesLeadV1EmailFn,
}));

vi.mock('../../../src/lib/excel', () => ({
  buildAnalyticsExcel: mockBuildAnalyticsExcel,
  buildExcelFilename: mockBuildExcelFilename,
}));

import { renderFormNotificationEmail, renderAnalyticsReportEmail, buildReportTitle, pageTitle, categorizeSource, resolveCta } from '../../../src/lib/templates';
import type { FormSubmittedPayload, ClientRow, AnalyticsReport, ResolvedPeriod, ReportPeriodPreset } from '../../../src/types/index';

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
  google_service_account_email: null,
  google_service_account_key: null,
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
  mockGenerateTopSourcesGauges.mockResolvedValue([mockChartBuffer, mockChartBuffer, mockChartBuffer]);
  mockGenerateTopPagesChart.mockResolvedValue(mockChartBuffer);
  mockAnalyticsReportEmailFn.mockReturnValue({ type: 'div', props: {} });
  mockSalesLeadV1EmailFn.mockReturnValue({ type: 'div', props: {} });
  mockBuildAnalyticsExcel.mockResolvedValue(Buffer.from('fake-xlsx'));
  mockBuildExcelFilename.mockReturnValue('analytics-acme-corp-2026-02-16-2026-02-22.xlsx');
});

// ---------------------------------------------------------------------------
// categorizeSource
// ---------------------------------------------------------------------------

describe('categorizeSource', () => {
  describe('Direct', () => {
    it.each(['direct', '(direct)', '(none)', '(not set)', ''])('"%s" → Direct', (s) => {
      expect(categorizeSource(s)).toBe('Direct');
    });
  });

  describe('Search', () => {
    it.each(['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'brave'])('"%s" → Search', (s) => {
      expect(categorizeSource(s)).toBe('Search');
    });
    it('partial match — "google.search.internal" → Search', () => {
      expect(categorizeSource('google.search.internal')).toBe('Search');
    });
  });

  describe('Social', () => {
    it.each(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'reddit', 'youtube', 'x.com', 't.co', 'pinterest'])('"%s" → Social', (s) => {
      expect(categorizeSource(s)).toBe('Social');
    });
    it('domain variant — "linkedin.com" → Social', () => {
      expect(categorizeSource('linkedin.com')).toBe('Social');
    });
  });

  describe('Email', () => {
    it.each(['email', 'newsletter', 'mailchimp', 'klaviyo', 'sendgrid', 'gmail'])('"%s" → Email', (s) => {
      expect(categorizeSource(s)).toBe('Email');
    });
    it('"weekly-newsletter" → Email', () => {
      expect(categorizeSource('weekly-newsletter')).toBe('Email');
    });
  });

  describe('Referral', () => {
    it.each(['acmecorp.com', 'techcrunch.com', 'some-partner-blog.io'])('"%s" → Referral', (s) => {
      expect(categorizeSource(s)).toBe('Referral');
    });
  });
});

// ---------------------------------------------------------------------------
// pageTitle
// ---------------------------------------------------------------------------

describe('pageTitle', () => {
  it('/ → "Home"', () => expect(pageTitle('/')).toBe('Home'));
  it('empty string → "Home"', () => expect(pageTitle('')).toBe('Home'));
  it('/about → "About"', () => expect(pageTitle('/about')).toBe('About'));
  it('/portfolio → "Portfolio"', () => expect(pageTitle('/portfolio')).toBe('Portfolio'));
  it('/case-studies → "Case Studies" (hyphens become spaces)', () => expect(pageTitle('/case-studies')).toBe('Case Studies'));
  it('/the_team → "The Team" (underscores become spaces)', () => expect(pageTitle('/the_team')).toBe('The Team'));
  it('/neighborhoods/the-preserve → "The Preserve" (uses last segment)', () => expect(pageTitle('/neighborhoods/the-preserve')).toBe('The Preserve'));
  it('/blog/my-first-post → "My First Post"', () => expect(pageTitle('/blog/my-first-post')).toBe('My First Post'));
  it('/a/b/c → "C" (deeply nested)', () => expect(pageTitle('/a/b/c')).toBe('C'));
});

// ---------------------------------------------------------------------------
// buildReportTitle
// ---------------------------------------------------------------------------

describe('buildReportTitle', () => {
  const cases: Array<[ReportPeriodPreset, string]> = [
    ['last_week',    'Weekly Analytics Report'],
    ['last_month',   'Monthly Analytics Report'],
    ['last_30_days', '30-Day Analytics Report'],
    ['last_90_days', '90-Day Analytics Report'],
    ['custom',       'Analytics Report'],
  ];

  it.each(cases)('preset "%s" → "%s"', (preset, expected) => {
    expect(buildReportTitle(preset)).toBe(expected);
  });
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
    formName: 'Contact Form',
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

  it('includes formName in the subject when provided', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.subject).toContain('Contact Form');
    expect(result.subject).toContain('New form submission:');
  });

  it('renders generic subject when formName is absent', async () => {
    const payloadNoForm: FormSubmittedPayload = {
      clientId: 'acme',
      submitterName: 'Jane Smith',
      submitterEmail: 'jane@example.com',
      submitterMessage: 'Hello.',
    };
    const result = await renderFormNotificationEmail(payloadNoForm, mockClient);
    expect(result.subject).toBe('New inquiry — Acme Corp');
    expect(result.subject).not.toContain('undefined');
  });

  // T008: minimal-payload rendering (US1)
  it('uses submitterEmail in previewText when name is absent', async () => {
    const emailOnly: FormSubmittedPayload = {
      clientId: 'acme',
      submitterEmail: 'jane@example.com',
    };
    await renderFormNotificationEmail(emailOnly, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ previewText: 'New inquiry from jane@example.com' }),
    );
  });

  it('uses generic previewText when both name and email are absent', async () => {
    const minimalPayload: FormSubmittedPayload = { clientId: 'acme' };
    await renderFormNotificationEmail(minimalPayload, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ previewText: 'New inquiry — Acme Corp' }),
    );
  });

  // T010: submittedFrom wiring (US2)
  it('passes submittedFrom as sourcePageLink and sourcePageText', async () => {
    const withSource: FormSubmittedPayload = {
      clientId: 'acme',
      submitterEmail: 'jane@example.com',
      submittedFrom: '/contact',
    };
    await renderFormNotificationEmail(withSource, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePageLink: '/contact', sourcePageText: '/contact' }),
    );
  });

  it('does not pass sourcePageLink when submittedFrom is absent', async () => {
    const noSource: FormSubmittedPayload = { clientId: 'acme', submitterEmail: 'jane@example.com' };
    await renderFormNotificationEmail(noSource, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePageLink: undefined, sourcePageText: undefined }),
    );
  });

  // T013: phone, formName, subject line (US3)
  it('passes submitterPhone as customerPhone', async () => {
    const withPhone: FormSubmittedPayload = {
      clientId: 'acme',
      submitterEmail: 'jane@example.com',
      submitterPhone: '(555) 123-4567',
    };
    await renderFormNotificationEmail(withPhone, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: '(555) 123-4567' }),
    );
  });

  it('passes formName as interestedIn', async () => {
    const withFormName: FormSubmittedPayload = {
      clientId: 'acme',
      submitterEmail: 'jane@example.com',
      formName: 'Quote Request',
    };
    await renderFormNotificationEmail(withFormName, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ interestedIn: 'Quote Request' }),
    );
  });

  it('renders subject with formName when present', async () => {
    const withFormName: FormSubmittedPayload = {
      clientId: 'acme',
      submitterEmail: 'jane@example.com',
      formName: 'Quote Request',
    };
    const result = await renderFormNotificationEmail(withFormName, mockClient);
    expect(result.subject).toBe('New form submission: Quote Request — Acme Corp');
  });

  // T017: customFields wiring (US4)
  it('passes customFields through to SalesLeadV1Email', async () => {
    const withCustom: FormSubmittedPayload = {
      clientId: 'acme',
      customFields: { 'Project Budget': '$5k' },
    };
    await renderFormNotificationEmail(withCustom, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ customFields: { 'Project Budget': '$5k' } }),
    );
  });

  it('passes undefined customFields when absent', async () => {
    const noCustom: FormSubmittedPayload = { clientId: 'acme', submitterEmail: 'jane@example.com' };
    await renderFormNotificationEmail(noCustom, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ customFields: undefined }),
    );
  });

  it('passes empty object customFields when provided as {}', async () => {
    const emptyCustom: FormSubmittedPayload = { clientId: 'acme', customFields: {} };
    await renderFormNotificationEmail(emptyCustom, mockClient);
    expect(mockSalesLeadV1EmailFn).toHaveBeenCalledWith(
      expect.objectContaining({ customFields: {} }),
    );
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

  it('returns 7 attachments (banner + 3 source gauges + daily + pages + xlsx) when all succeed', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.attachments).toHaveLength(7);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_sources_0.png');
    expect(filenames).toContain('chart_pages.png');
    expect(filenames).toContain('analytics-acme-corp-2026-02-16-2026-02-22.xlsx');
  });

  it('omits sources chart when topSources is empty (graceful fallback)', async () => {
    // Real implementation throws for empty array — replicate that in the mock
    mockGenerateTopSourcesGauges.mockRejectedValue(new Error('sources array is empty'));
    const reportNoSources: AnalyticsReport = { ...mockReport, topSources: [] };
    const result = await renderAnalyticsReportEmail(reportNoSources, mockClient, mockPeriod);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).not.toContain('chart_sources.png');
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_pages.png');
  });

  it('returns 4 attachments when one chart fn throws (banner + daily + pages + xlsx)', async () => {
    mockGenerateTopSourcesGauges.mockRejectedValue(new Error('QuickChart 500'));
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.attachments).toHaveLength(4);
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).not.toContain('chart_sources.png');
    expect(filenames).toContain('banner_image.png');
    expect(filenames).toContain('chart_daily.png');
    expect(filenames).toContain('chart_pages.png');
    expect(filenames).toContain('analytics-acme-corp-2026-02-16-2026-02-22.xlsx');
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
    const sources0 = result.attachments.find(a => a.filename === 'chart_sources_0.png')!;
    const pages = result.attachments.find(a => a.filename === 'chart_pages.png')!;
    expect(daily.content_id).toBe('chart_daily');
    expect(sources0.content_id).toBe('chart_sources_0');
    expect(pages.content_id).toBe('chart_pages');
  });

  it('xlsx attachment has correct filename and content_type', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    const xlsx = result.attachments.find(a => a.filename.endsWith('.xlsx'))!;
    expect(xlsx).toBeDefined();
    expect(xlsx.filename).toBe('analytics-acme-corp-2026-02-16-2026-02-22.xlsx');
    expect(xlsx.content_type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(xlsx.content).toEqual(Buffer.from('fake-xlsx'));
  });

  it('still resolves successfully when buildAnalyticsExcel rejects (non-blocking failure)', async () => {
    mockBuildAnalyticsExcel.mockRejectedValue(new Error('out of memory'));
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.html).toBeDefined();
    const filenames = result.attachments.map(a => a.filename);
    expect(filenames).not.toContain('analytics-acme-corp-2026-02-16-2026-02-22.xlsx');
    expect(filenames).toContain('banner_image.png');
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

  it('passes "Weekly Analytics Report" as header for last_week preset', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, { ...mockPeriod, preset: 'last_week' });
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.header).toBe('Weekly Analytics Report');
  });

  it('passes "Monthly Analytics Report" as header for last_month preset', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, { ...mockPeriod, preset: 'last_month' });
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.header).toBe('Monthly Analytics Report');
  });

  it('passes "30-Day Analytics Report" as header for last_30_days preset', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, { ...mockPeriod, preset: 'last_30_days' });
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.header).toBe('30-Day Analytics Report');
  });

  it('passes "90-Day Analytics Report" as header for last_90_days preset', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, { ...mockPeriod, preset: 'last_90_days' });
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.header).toBe('90-Day Analytics Report');
  });

  it('passes "Analytics Report" as header for custom preset', async () => {
    await renderAnalyticsReportEmail(mockReport, mockClient, { ...mockPeriod, preset: 'custom' });
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.header).toBe('Analytics Report');
  });

  it('formats ISO date (YYYY-MM-DD) to MM/DD/YYYY in dailyMetrics passed to template', async () => {
    const report = { ...mockReport, dailyMetrics: [{ date: '2026-02-16', sessions: 100, activeUsers: 80, newUsers: 20 }] };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.dailyMetrics[0].date).toBe('02/16/2026');
  });

  it('topSources props include a category derived from the source name', async () => {
    const report = {
      ...mockReport,
      topSources: [
        { source: 'google', sessions: 2000 },
        { source: 'direct', sessions: 1500 },
        { source: 'linkedin.com', sessions: 800 },
        { source: 'newsletter', sessions: 400 },
        { source: 'techcrunch.com', sessions: 200 },
      ],
    };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.topSources[0].category).toBe('Search');
    expect(props.topSources[1].category).toBe('Direct');
    expect(props.topSources[2].category).toBe('Social');
    expect(props.topSources[3].category).toBe('Email');
    expect(props.topSources[4].category).toBe('Referral');
  });

  it('passes aggregated category totals (not raw sources) to generateTopSourcesChart', async () => {
    const report = {
      ...mockReport,
      sessions: 4820,
      topSources: [
        { source: 'google', sessions: 2000 },
        { source: 'bing', sessions: 500 },    // also Search — should be merged
        { source: 'direct', sessions: 1500 },
      ],
    };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    expect(mockGenerateTopSourcesGauges).toHaveBeenCalledOnce();
    const [categories, totalSessions] = mockGenerateTopSourcesGauges.mock.calls[0];
    const searchEntry = categories.find((c: any) => c.label === 'Search');
    expect(searchEntry?.sessions).toBe(2500); // 2000 + 500 merged
    expect(totalSessions).toBe(4820);
  });

  it('appends an Other slice so the pie chart represents 100% of total traffic', async () => {
    // topSources sum to 3500; report.sessions = 4820 → Other = 1320
    const report = {
      ...mockReport,
      sessions: 4820,
      topSources: [
        { source: 'google', sessions: 2100 },  // Search
        { source: 'direct', sessions: 1400 },  // Direct
      ],
    };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [categories] = mockGenerateTopSourcesGauges.mock.calls[0];
    const other = categories.find((c: any) => c.label === 'Other');
    expect(other?.sessions).toBe(1320);
  });

  it('omits the Other slice when topSources already account for all sessions', async () => {
    const report = {
      ...mockReport,
      sessions: 3500,
      topSources: [
        { source: 'google', sessions: 2000 },
        { source: 'direct', sessions: 1500 },
      ],
    };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [categories] = mockGenerateTopSourcesGauges.mock.calls[0];
    expect(categories.find((c: any) => c.label === 'Other')).toBeUndefined();
  });

  it('topPages props include a human-readable name derived from the path', async () => {
    const report = {
      ...mockReport,
      topPages: [
        { path: '/', views: 500 },
        { path: '/services', views: 300 },
        { path: '/neighborhoods/the-preserve', views: 120 },
      ],
    };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.topPages[0].name).toBe('Home');
    expect(props.topPages[1].name).toBe('Services');
    expect(props.topPages[2].name).toBe('The Preserve');
  });

  it('topPages props preserve the original path alongside the name', async () => {
    const report = { ...mockReport, topPages: [{ path: '/case-studies', views: 200 }] };
    await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
    const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
    expect(props.topPages[0].name).toBe('Case Studies');
    expect(props.topPages[0].path).toBe('/case-studies');
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
    { periodLabel: 'Jan 26', periodStart: '2026-01-26', sessions: 3000, activeUsers: 2000, newUsers: 400, avgSessionDurationSecs: 160 },
    { periodLabel: 'Feb 2',  periodStart: '2026-02-02', sessions: 3500, activeUsers: 2400, newUsers: 450, avgSessionDurationSecs: 165 },
    { periodLabel: 'Feb 9',  periodStart: '2026-02-09', sessions: 4000, activeUsers: 2800, newUsers: 500, avgSessionDurationSecs: 170 },
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

    it('prior bar label uses MM/DD format for last_week preset', async () => {
      const report = { ...mockReport, historicalPeriods: [threePriors[2]] }; // periodStart: 2026-02-09
      await renderAnalyticsReportEmail(report, mockClient, mockPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars[0].label).toBe('02/09'); // last_week → MM/DD
    });

    it('prior bar label uses month name for last_month preset', async () => {
      const report = { ...mockReport, historicalPeriods: [threePriors[2]] }; // periodStart: 2026-02-09
      const monthPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'last_month' };
      await renderAnalyticsReportEmail(report, mockClient, monthPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars[0].label).toBe('Feb'); // last_month → Mon
    });

    it('prior bar label uses month range for last_90_days preset', async () => {
      // periodStart 2026-10-01 + 89 days = 2026-12-29 → Oct–Dec
      const prior90 = { periodLabel: 'Oct 1', periodStart: '2026-10-01', sessions: 3000, activeUsers: 2000, newUsers: 400, avgSessionDurationSecs: 160 };
      const report = { ...mockReport, historicalPeriods: [prior90] };
      const ninetyPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'last_90_days' };
      await renderAnalyticsReportEmail(report, mockClient, ninetyPeriod);
      const [props] = mockAnalyticsReportEmailFn.mock.calls[0];
      expect(props.sessions.bars[0].label).toBe('Oct–Dec'); // last_90_days → Mon–Mon
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
        { periodLabel: 'Jan 26', periodStart: '2026-01-26', sessions: 3500, activeUsers: 2000, newUsers: 400, avgSessionDurationSecs: 160 },
        { periodLabel: 'Feb 2',  periodStart: '2026-02-02', sessions: 3500, activeUsers: 2400, newUsers: 450, avgSessionDurationSecs: 165 },
        { periodLabel: 'Feb 9',  periodStart: '2026-02-09', sessions: 3500, activeUsers: 2800, newUsers: 500, avgSessionDurationSecs: 170 },
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

// ---------------------------------------------------------------------------
// resolveCta
// ---------------------------------------------------------------------------

describe('resolveCta', () => {
  describe('no ctaButton provided (default behaviour)', () => {
    it('submitterEmail + submitterName → default mailto href and "Reply to {name}" label', () => {
      const result = resolveCta(undefined, 'jane@example.com', 'Jane');
      expect(result).toEqual({ ctaHref: 'mailto:jane@example.com', ctaLabel: 'Reply to Jane' });
    });

    it('submitterEmail without submitterName → "Reply" label', () => {
      const result = resolveCta(undefined, 'jane@example.com', undefined);
      expect(result).toEqual({ ctaHref: 'mailto:jane@example.com', ctaLabel: 'Reply' });
    });

    it('no submitterEmail → both undefined (button suppressed)', () => {
      const result = resolveCta(undefined, undefined, 'Jane');
      expect(result).toEqual({ ctaHref: undefined, ctaLabel: undefined });
    });
  });

  describe('action.type = "url"', () => {
    it('valid https URL → returns that URL', () => {
      const result = resolveCta(
        { text: 'View in CRM', action: { type: 'url', url: 'https://crm.example.com/lead/1' } },
        'jane@example.com',
        'Jane',
      );
      expect(result).toEqual({ ctaHref: 'https://crm.example.com/lead/1', ctaLabel: 'View in CRM' });
    });

    it('valid http URL → returns that URL', () => {
      const result = resolveCta(
        { action: { type: 'url', url: 'http://internal.example.com' } },
        'jane@example.com',
        'Jane',
      );
      expect(result.ctaHref).toBe('http://internal.example.com');
    });

    it('invalid URL (no protocol) → falls back to submitterEmail mailto', () => {
      const result = resolveCta(
        { text: 'Broken', action: { type: 'url', url: 'not-a-url' } },
        'jane@example.com',
        'Jane',
      );
      expect(result).toEqual({ ctaHref: 'mailto:jane@example.com', ctaLabel: 'Reply to Jane' });
    });

    it('empty URL string → falls back to submitterEmail mailto', () => {
      const result = resolveCta(
        { action: { type: 'url', url: '' } },
        'jane@example.com',
        'Jane',
      );
      expect(result.ctaHref).toBe('mailto:jane@example.com');
    });

    it('invalid URL + no submitterEmail → both undefined', () => {
      const result = resolveCta(
        { action: { type: 'url', url: 'not-a-url' } },
        undefined,
        undefined,
      );
      expect(result).toEqual({ ctaHref: undefined, ctaLabel: undefined });
    });
  });

  describe('action.type = "mailto"', () => {
    it('email provided → mailto:customEmail', () => {
      const result = resolveCta(
        { text: 'Contact Sales', action: { type: 'mailto', email: 'sales@example.com' } },
        'jane@example.com',
        'Jane',
      );
      expect(result).toEqual({ ctaHref: 'mailto:sales@example.com', ctaLabel: 'Contact Sales' });
    });

    it('no email, submitterEmail present → mailto:submitterEmail', () => {
      const result = resolveCta(
        { action: { type: 'mailto' } },
        'jane@example.com',
        'Jane',
      );
      expect(result).toEqual({ ctaHref: 'mailto:jane@example.com', ctaLabel: 'Reply to Jane' });
    });

    it('no email, no submitterEmail → both undefined', () => {
      const result = resolveCta(
        { action: { type: 'mailto' } },
        undefined,
        undefined,
      );
      expect(result).toEqual({ ctaHref: undefined, ctaLabel: undefined });
    });
  });

  describe('action absent (text only)', () => {
    it('ctaButton.text only → uses submitterEmail as href and custom text as label', () => {
      const result = resolveCta(
        { text: 'Get Back to Jane' },
        'jane@example.com',
        'Jane',
      );
      expect(result).toEqual({ ctaHref: 'mailto:jane@example.com', ctaLabel: 'Get Back to Jane' });
    });

    it('ctaButton.text only, no submitterEmail → both undefined', () => {
      const result = resolveCta({ text: 'Get Back to Jane' }, undefined, undefined);
      expect(result).toEqual({ ctaHref: undefined, ctaLabel: undefined });
    });
  });

  describe('label resolution', () => {
    it('empty ctaButton.text → falls back to defaultLabel', () => {
      const result = resolveCta(
        { text: '', action: { type: 'url', url: 'https://example.com' } },
        'jane@example.com',
        'Jane',
      );
      expect(result.ctaLabel).toBe('Reply to Jane');
    });

    it('whitespace-only ctaButton.text → falls back to defaultLabel', () => {
      const result = resolveCta(
        { text: '   ', action: { type: 'url', url: 'https://example.com' } },
        'jane@example.com',
        'Jane',
      );
      expect(result.ctaLabel).toBe('Reply to Jane');
    });

    it('ctaButton.text with surrounding whitespace → trims it', () => {
      const result = resolveCta(
        { text: '  View Lead  ', action: { type: 'url', url: 'https://example.com' } },
        'jane@example.com',
        'Jane',
      );
      expect(result.ctaLabel).toBe('View Lead');
    });
  });

  describe('button suppressed when no href', () => {
    it('ctaLabel is undefined when ctaHref is undefined', () => {
      const result = resolveCta({ text: 'Any Label' }, undefined, undefined);
      expect(result.ctaLabel).toBeUndefined();
    });
  });
});
