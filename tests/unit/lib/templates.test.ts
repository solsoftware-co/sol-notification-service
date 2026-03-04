// T028: templates module unit tests

const mockReadFile = vi.hoisted(() => vi.fn());
const mockRender = vi.hoisted(() => vi.fn());

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

import { renderFormNotificationEmail, renderAnalyticsReportEmail } from '../../../src/lib/templates';
import type { FormSubmittedPayload, ClientRow, AnalyticsReport, ResolvedPeriod } from '../../../src/types/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockBannerBuffer = Buffer.from('fake-png-data');
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

  it('returns one attachment with the banner filename and correct Content-ID header', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('banner_image.png');
    expect(result.attachments[0].headers?.['Content-ID']).toBe('<banner_image.png>');
  });

  it('includes the banner buffer content in the attachment', async () => {
    const result = await renderFormNotificationEmail(payload, mockClient);
    expect(result.attachments[0].content).toBe(mockBannerBuffer);
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

  it('returns one attachment with the banner filename', async () => {
    const result = await renderAnalyticsReportEmail(mockReport, mockClient, mockPeriod);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('banner_image.png');
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
});
