// T014 + T015 + T019 + T029 + T008(022): analytics-report unit tests

const mockGetClientById = vi.hoisted(() => vi.fn());
const mockGetAnalyticsReport = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockRenderAnalyticsReport = vi.hoisted(() => vi.fn());
const mockWriteNotificationLog = vi.hoisted(() => vi.fn());
const mockResolveRecipients = vi.hoisted(() => vi.fn());

// config MUST be mocked first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    solApiUrl: "https://sol-api-staging.solsoftware.workers.dev",
    solApiKey: "test-key",
    ga4CredentialsJson: null,
  },
}));

vi.mock("../../../../src/lib/sol-api", () => ({
  getClientById: mockGetClientById,
  writeNotificationLog: mockWriteNotificationLog,
}));

vi.mock("../../../../src/lib/analytics", () => ({
  getAnalyticsReport: mockGetAnalyticsReport,
}));

vi.mock("../../../../src/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("../../../../src/lib/notifications", () => ({
  resolveRecipients: mockResolveRecipients,
}));

vi.mock("../../../../src/lib/templates", async () => {
  const actual = await vi.importActual<typeof import("../../../../src/lib/templates")>("../../../../src/lib/templates");
  return {
    renderAnalyticsReportEmail: mockRenderAnalyticsReport,
    buildReportTitle: actual.buildReportTitle,
  };
});

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
  setRunContext: vi.fn(),
}));

import { InngestTestEngine, mockCtx } from "@inngest/test";
import { sendAnalyticsReport } from "../../../../src/inngest/functions/analytics-report";
import { resolveRecipients } from "../../../../src/lib/notifications";
import { config } from "../../../../src/lib/config";
import type {
  ClientRow,
  AnalyticsReport,
  EmailResult,
  ResolvedPeriod,
  SupportedTimezone,
} from "../../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// scheduledAt is a Tuesday — critical for last_week date math assertions
const scheduledAt = "2026-02-24T09:00:00.000Z";

const mockClient: ClientRow = {
  id: "client-1",
  name: "Test Client",
  email: "client@example.com",
  ga4_property_id: "123456789",
  active: true,
  settings: {},
  created_at: new Date(),
  google_service_account_email: null,
  google_service_account_key: null,
  timezone: "America/Chicago",
};

const mockResolvedPeriod: ResolvedPeriod = {
  start: "2026-02-16",
  end: "2026-02-22",
  label: "Feb 16 \u2013 Feb 22, 2026",
  preset: "last_week",
};

const mockReport: AnalyticsReport = {
  sessions: 100,
  activeUsers: 80,
  newUsers: 30,
  avgSessionDurationSecs: 120,
  topSources: [{ source: "google", sessions: 60 }],
  topPages: [{ path: "/", views: 200 }],
  dailyMetrics: [{ date: "20260216", sessions: 14, activeUsers: 11, newUsers: 4 }],
  resolvedPeriod: mockResolvedPeriod,
  isMock: true,
};

const mockEmailResult: EmailResult = {
  mode: "mock",
  originalTo: ["client@example.com"],
  actualTo: ["client@example.com"],
  subject: "Your analytics report \u2014 Feb 16 \u2013 Feb 22, 2026",
  outcome: "logged",
};

const mockLiveEmailResult: EmailResult = {
  mode: "live",
  originalTo: ["client@example.com"],
  actualTo: ["client@example.com"],
  subject: "Your analytics report \u2014 Feb 16 \u2013 Feb 22, 2026",
  outcome: "sent",
  resendId: "resend-abc123",
};

const baseEvent = {
  name: "analytics/report.requested" as const,
  data: {
    clientId: "client-1",
    reportPeriod: { preset: "last_week" as const },
    scheduledAt,
  },
};

// ---------------------------------------------------------------------------
// Base test engine
// ---------------------------------------------------------------------------

const t = new InngestTestEngine({
  function: sendAnalyticsReport,
  events: [baseEvent],
  transformCtx: (ctx: any) => mockCtx(ctx),
});

// Factory for executeStep() calls targeting steps AFTER wait-for-send-window.
// Fresh engine per test avoids @inngest/test mockHandlerCache pollution across tests.
function freshAfterSleepEngine(events?: any[]) {
  return new InngestTestEngine({
    function: sendAnalyticsReport,
    events: events ?? [baseEvent],
    steps: [
      { id: "resolve-send-time", handler: () => scheduledAt },
      { id: "wait-for-send-window", handler: () => undefined },
    ],
    transformCtx: (ctx: any) => mockCtx(ctx),
  });
}

// Fresh engine per test — avoids @inngest/test step result caching between tests.
// wait-for-send-window (sleepUntil) must be pre-mocked so execute() doesn't hang.
function freshEngine() {
  return new InngestTestEngine({
    function: sendAnalyticsReport,
    events: [baseEvent],
    steps: [{ id: "wait-for-send-window", handler: () => undefined }],
    transformCtx: (ctx: any) => mockCtx(ctx),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  (config as any).emailMode = "mock"; // reset to default before each test
  mockGetClientById.mockResolvedValue(mockClient);
  mockGetAnalyticsReport.mockResolvedValue(mockReport);
  mockSendEmail.mockResolvedValue(mockEmailResult);
  mockRenderAnalyticsReport.mockResolvedValue({
    subject: "Your analytics report — Feb 16 \u2013 Feb 22, 2026",
    html: "<html>mock</html>",
    attachments: [],
  });
  // Default: no preferences configured — resolveRecipients falls back to client.email
  mockResolveRecipients.mockReturnValue({ recipients: ["client@example.com"], source: "client_email" });
});

// ---------------------------------------------------------------------------
// T014: Happy path — validate-payload
// ---------------------------------------------------------------------------

describe("validate-payload", () => {
  it("succeeds when clientId is present", async () => {
    const output = await t.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
  });
});

// ---------------------------------------------------------------------------
// T015: validate-payload — missing clientId
// ---------------------------------------------------------------------------

describe("validate-payload — failure", () => {
  it("throws when clientId is missing", async () => {
    const tMissing = t.clone({
      events: [
        {
          ...baseEvent,
          data: { ...baseEvent.data, clientId: "" },
        },
      ],
    });

    const output = await tMissing.executeStep("validate-payload");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toBe(
      "Missing required field: clientId"
    );
  });
});

// ---------------------------------------------------------------------------
// T014: Happy path — fetch-client-config
// ---------------------------------------------------------------------------

describe("fetch-client-config", () => {
  it("fetches client by id and returns it", async () => {
    const output = await t.executeStep("fetch-client-config");

    expect(output.step.op).toBe("StepRun");
    expect(mockGetClientById).toHaveBeenCalledWith("client-1");
  });
});

// ---------------------------------------------------------------------------
// T015: fetch-client-config — failure paths
// ---------------------------------------------------------------------------

describe("fetch-client-config — failure", () => {
  it("throws when client is not found", async () => {
    mockGetClientById.mockRejectedValue(new Error("Client not found: client-1"));

    const output = await t.executeStep("fetch-client-config");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toBe("Client not found: client-1");
  });

  // NOTE: null ga4_property_id is now handled by the check-ga4-config step, not here.
});

// ---------------------------------------------------------------------------
// T014: Happy path — resolve-report-period (last_week date math)
// ---------------------------------------------------------------------------

describe("resolve-report-period — last_week", () => {
  it("resolves to Mon\u2013Sun of prior full week when scheduledAt is a Tuesday", async () => {
    // scheduledAt = 2026-02-24 (Tuesday)
    // end   = scheduledAt - 2 days = 2026-02-22 (Sunday)
    // start = scheduledAt - 8 days = 2026-02-16 (Monday)
    const output = await freshAfterSleepEngine().executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual({
      start: "2026-02-16",
      end: "2026-02-22",
      label: "Feb 16 \u2013 Feb 22, 2026",
      preset: "last_week",
    });
  });
});

// ---------------------------------------------------------------------------
// T019: Period preset resolution — last_month
// ---------------------------------------------------------------------------

describe("resolve-report-period — last_month", () => {
  it("resolves to the full prior calendar month when scheduledAt is in February 2026", async () => {
    // scheduledAt = 2026-02-24 → previous month = January 2026
    // start = 2026-01-01, end = 2026-01-31
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "last_month" as const } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
      label: "Jan 1 \u2013 Jan 31, 2026",
      preset: "last_month",
    });
  });
});

// ---------------------------------------------------------------------------
// T019: Period preset resolution — last_30_days
// ---------------------------------------------------------------------------

describe("resolve-report-period — last_30_days", () => {
  it("sets end to yesterday and start to 29 days before yesterday", async () => {
    // scheduledAt = 2026-02-24
    // yesterday   = 2026-02-23  → end
    // start       = 2026-02-23 - 29 days = 2026-01-25
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "last_30_days" as const } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toMatchObject({
      start: "2026-01-25",
      end: "2026-02-23",
      preset: "last_30_days",
    });
  });
});

// ---------------------------------------------------------------------------
// T019: Period preset resolution — custom (valid)
// ---------------------------------------------------------------------------

describe("resolve-report-period — custom", () => {
  it("uses verbatim start and end when both are provided", async () => {
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "custom" as const, start: "2026-01-01", end: "2026-01-15" } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toMatchObject({
      start: "2026-01-01",
      end: "2026-01-15",
      preset: "custom",
    });
  });
});

// ---------------------------------------------------------------------------
// T015 + T019: resolve-report-period — failure paths
// ---------------------------------------------------------------------------

describe("resolve-report-period — failure", () => {
  it("throws for unknown preset", async () => {
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "unknown_preset" as any } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toContain("Unknown report period preset");
  });

  it("throws for custom preset when end is missing", async () => {
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "custom" as const, start: "2026-01-01" } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toContain("start");
    expect((output.step.error as any)?.message).toContain("end");
  });

  it("throws for custom preset when start is missing", async () => {
    const output = await freshAfterSleepEngine([
      { ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "custom" as const, end: "2026-01-15" } } },
    ]).executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toContain("start");
  });
});

// ---------------------------------------------------------------------------
// T015: fetch-analytics-data — GA4 error propagates
// ---------------------------------------------------------------------------

describe("fetch-analytics-data — GA4 error propagation", () => {
  it("propagates GA4 API error without swallowing", async () => {
    mockGetAnalyticsReport.mockRejectedValue(new Error("GA4 API unavailable"));

    const output = await freshAfterSleepEngine().executeStep("fetch-analytics-data");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toBe("GA4 API unavailable");
  });
});

// ---------------------------------------------------------------------------
// T014: Happy path — full execute (last_week, all steps)
// ---------------------------------------------------------------------------

describe("full execute — happy path, last_week", () => {
  it("completes all steps and returns the expected result payload", async () => {
    const { result } = await freshEngine().execute();

    expect(result).toMatchObject({
      clientId: "client-1",
      preset: "last_week",
      resolvedPeriod: {
        start: "2026-02-16",
        end: "2026-02-22",
        preset: "last_week",
      },
      outcome: "logged",
      isMock: true,
    });
  });

  it("calls renderAnalyticsReportEmail with report, client, and resolved period", async () => {
    await freshEngine().execute();

    expect(mockRenderAnalyticsReport).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: 100, isMock: true }),
      expect.objectContaining({ id: "client-1" }),
      expect.objectContaining({ preset: "last_week" }),
    );
  });

  it("calls sendEmail with resolved recipients and resolved period label in subject", async () => {
    await freshEngine().execute();

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["client@example.com"],
        subject: expect.stringContaining("Feb 16 \u2013 Feb 22, 2026"),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Notification preferences — analytics_report key
// ---------------------------------------------------------------------------

describe("send-email — notification preferences", () => {
  it("uses the configured analytics_report recipient list when preferences are set", async () => {
    const preferenceList = ["marketing@example.com", "cmo@example.com"];
    mockResolveRecipients.mockReturnValue({ recipients: preferenceList, source: "settings" });

    const tWithClient = t.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-send-time", handler: () => scheduledAt },
        { id: "wait-for-send-window", handler: () => undefined },
        { id: "resolve-report-period", handler: () => mockResolvedPeriod },
        { id: "fetch-analytics-data", handler: () => mockReport },
      ],
    });

    await tWithClient.executeStep("send-email");

    expect(resolveRecipients).toHaveBeenCalledWith(mockClient, "analytics_report");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["marketing@example.com", "cmo@example.com"] })
    );
  });

  it("falls back to [client.email] when no analytics_report preference is configured", async () => {
    mockResolveRecipients.mockReturnValue({ recipients: ["client@example.com"], source: "client_email" });

    const tWithClient = t.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-send-time", handler: () => scheduledAt },
        { id: "wait-for-send-window", handler: () => undefined },
        { id: "resolve-report-period", handler: () => mockResolvedPeriod },
        { id: "fetch-analytics-data", handler: () => mockReport },
      ],
    });

    await tWithClient.executeStep("send-email");

    expect(resolveRecipients).toHaveBeenCalledWith(mockClient, "analytics_report");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["client@example.com"] })
    );
  });
});

// ---------------------------------------------------------------------------
// T011: check-ga4-config step
// ---------------------------------------------------------------------------

describe("check-ga4-config — client has GA4 property", () => {
  it("does not skip — function completes and sends email", async () => {
    const { result } = await freshEngine().execute();

    expect(result).toMatchObject({ clientId: "client-1", outcome: "logged" });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("check-ga4-config — client has no GA4 property, emailMode mock", () => {
  it("proceeds and sends email (non-live mode falls back to mock analytics data)", async () => {
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    const { result } = await freshEngine().execute();

    // In mock/test/mailtrap modes, analytics.ts returns mock data when GA4 is absent,
    // so the workflow should complete normally rather than skipping.
    expect(result).toMatchObject({ clientId: "client-1", outcome: "logged" });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("check-ga4-config — client has no GA4 property, emailMode live", () => {
  it("writes a skipped log record and does not send email", async () => {
    (config as any).emailMode = "live";
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    const { result } = await new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [baseEvent],
      steps: [{ id: "wait-for-send-window", handler: () => undefined }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    }).execute();

    expect(result).toMatchObject({ clientId: "client-1", outcome: "skipped" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "skipped",
        error_message: "Client has no GA4 property configured",
        client_id: "client-1",
        workflow: "send-analytics-report",
      })
    );
  });

  it('skip-log subject is "Weekly Analytics Report" for last_week preset', async () => {
    (config as any).emailMode = "live";
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    await freshEngine().execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Weekly Analytics Report" })
    );
  });

  it('skip-log subject is "Monthly Analytics Report" for last_month preset', async () => {
    (config as any).emailMode = "live";
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, reportPeriod: { preset: "last_month" as const } } }],
      steps: [{ id: "wait-for-send-window", handler: () => undefined }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    await engine.execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Monthly Analytics Report" })
    );
  });
});

// ---------------------------------------------------------------------------
// T008: log-result step — writeNotificationLog guard
// ---------------------------------------------------------------------------

describe("log-result — emailMode live", () => {
  it("calls writeNotificationLog with correct fields and metadata", async () => {
    (config as any).emailMode = "live";
    mockSendEmail.mockResolvedValue(mockLiveEmailResult);

    await freshEngine().execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-1",
        workflow: "send-analytics-report",
        event_name: "analytics/report.requested",
        outcome: "sent",
        recipient_email: "client@example.com",
        subject: "Your analytics report \u2014 Feb 16 \u2013 Feb 22, 2026",
        resend_id: "resend-abc123",
        metadata: expect.objectContaining({
          ga4_property_id: "123456789",
          period_preset: "last_week",
          date_range_start: "2026-02-16",
          date_range_end: "2026-02-22",
        }),
      })
    );
  });
});

describe("log-result — emailMode mock", () => {
  it("does not call writeNotificationLog", async () => {
    await freshEngine().execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("log-result — emailMode test", () => {
  it("does not call writeNotificationLog", async () => {
    (config as any).emailMode = "test";

    await freshEngine().execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T008 (022): resolve-send-time step — timezone-aware 9 AM computation
// Use fresh InngestTestEngine (not t.clone) to avoid cached step results from prior tests.
// ---------------------------------------------------------------------------

describe("resolve-send-time — ET winter (EST UTC-5)", () => {
  it("returns 14:00 UTC = 9 AM ET on a Monday when scheduledAt is midnight UTC", async () => {
    // Feb 2, 2026 = Monday; midnight UTC → local date in ET = Feb 1 → next9am = Feb 2 14:00 UTC
    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, scheduledAt: "2026-02-02T00:00:00.000Z", enforceDeliveryWindow: true } }],
      steps: [{ id: "fetch-client-config", handler: () => ({ ...mockClient, timezone: "America/New_York" as SupportedTimezone }) }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const output = await engine.executeStep("resolve-send-time");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe("2026-02-02T14:00:00.000Z");
  });
});

describe("resolve-send-time — ET summer (EDT UTC-4)", () => {
  it("returns 13:00 UTC = 9 AM ET on a Thursday when scheduledAt is midnight UTC in July", async () => {
    // Jul 2, 2026 = Thursday; midnight UTC → local date in ET = Jul 1 → next9am = Jul 2 13:00 UTC
    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, scheduledAt: "2026-07-02T00:00:00.000Z", enforceDeliveryWindow: true } }],
      steps: [{ id: "fetch-client-config", handler: () => ({ ...mockClient, timezone: "America/New_York" as SupportedTimezone }) }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const output = await engine.executeStep("resolve-send-time");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe("2026-07-02T13:00:00.000Z");
  });
});

describe("resolve-send-time — PT winter (PST UTC-8)", () => {
  it("returns 17:00 UTC = 9 AM PT on a Monday when scheduledAt is midnight UTC", async () => {
    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, scheduledAt: "2026-02-02T00:00:00.000Z", enforceDeliveryWindow: true } }],
      steps: [{ id: "fetch-client-config", handler: () => ({ ...mockClient, timezone: "America/Los_Angeles" as SupportedTimezone }) }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const output = await engine.executeStep("resolve-send-time");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe("2026-02-02T17:00:00.000Z");
  });
});

describe("resolve-send-time — weekend deferral", () => {
  it("defers Saturday+Sunday and returns Monday 9 AM ET", async () => {
    // Apr 4 2026 = Saturday midnight UTC → next9am lands on Apr 4 (Sat) → defer
    // → Apr 5 (Sun) → defer → Apr 6 (Mon) 13:00 UTC (EDT)
    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, scheduledAt: "2026-04-04T00:00:00.000Z", enforceDeliveryWindow: true } }],
      steps: [{ id: "fetch-client-config", handler: () => ({ ...mockClient, timezone: "America/New_York" as SupportedTimezone }) }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const output = await engine.executeStep("resolve-send-time");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe("2026-04-06T13:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// T008 (022): wait-for-send-window — sleepUntil called with resolved time
// Use executeStep (not execute) to avoid the sleepUntil spy firing on every replay.
// ---------------------------------------------------------------------------

describe("wait-for-send-window — sleepUntil called with resolved send time", () => {
  it("calls step.sleepUntil with the ISO string from resolve-send-time", async () => {
    const sleepUntilCalls: Array<{ id: string; until: string }> = [];

    const engine = new InngestTestEngine({
      function: sendAnalyticsReport,
      events: [{ ...baseEvent, data: { ...baseEvent.data, scheduledAt: "2026-02-02T00:00:00.000Z", enforceDeliveryWindow: true } }],
      steps: [
        { id: "fetch-client-config", handler: () => ({ ...mockClient, timezone: "America/Chicago" as SupportedTimezone }) },
        { id: "resolve-send-time", handler: () => "2026-02-02T15:00:00.000Z" },
      ],
      transformCtx: (ctx: any) => {
        const base = mockCtx(ctx);
        return {
          ...base,
          step: {
            ...base.step,
            sleepUntil: async (id: string, until: any) => {
              sleepUntilCalls.push({ id, until: until instanceof Date ? until.toISOString() : until });
              // Call through so @inngest/test's checkpoint mechanism records the op correctly
              return base.step.sleepUntil(id, until);
            },
          },
        };
      },
    });

    await engine.executeStep("wait-for-send-window");

    expect(sleepUntilCalls).toHaveLength(1);
    expect(sleepUntilCalls[0]).toEqual({
      id: "wait-for-send-window",
      until: "2026-02-02T15:00:00.000Z",
    });
  });
});
