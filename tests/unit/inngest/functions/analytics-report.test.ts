// T014 + T015 + T019 + T029: analytics-report unit tests

const mockGetClientById = vi.hoisted(() => vi.fn());
const mockGetAnalyticsReport = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockRenderAnalyticsReport = vi.hoisted(() => vi.fn());
const mockWriteNotificationLog = vi.hoisted(() => vi.fn());

// config MUST be mocked first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    databaseUrl: "postgresql://mock",
    ga4CredentialsJson: null,
  },
}));

vi.mock("../../../../src/lib/db", () => ({
  getClientById: mockGetClientById,
  writeNotificationLog: mockWriteNotificationLog,
}));

vi.mock("../../../../src/lib/analytics", () => ({
  getAnalyticsReport: mockGetAnalyticsReport,
}));

vi.mock("../../../../src/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("../../../../src/lib/templates", () => ({
  renderAnalyticsReportEmail: mockRenderAnalyticsReport,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));

import { InngestTestEngine, mockCtx } from "@inngest/test";
import { sendAnalyticsReport } from "../../../../src/inngest/functions/analytics-report";
import { config } from "../../../../src/lib/config";
import type {
  ClientRow,
  AnalyticsReport,
  EmailResult,
  ResolvedPeriod,
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
  originalTo: "client@example.com",
  actualTo: "client@example.com",
  subject: "Your analytics report \u2014 Feb 16 \u2013 Feb 22, 2026",
  outcome: "logged",
};

const mockLiveEmailResult: EmailResult = {
  mode: "live",
  originalTo: "client@example.com",
  actualTo: "client@example.com",
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

// Fresh engine per test — avoids @inngest/test step result caching between tests
function freshEngine() {
  return new InngestTestEngine({
    function: sendAnalyticsReport,
    events: [baseEvent],
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
    const output = await t.executeStep("resolve-report-period");

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
    const tLastMonth = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: { preset: "last_month" as const },
          },
        },
      ],
    });

    const output = await tLastMonth.executeStep("resolve-report-period");

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
    const tLast30 = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: { preset: "last_30_days" as const },
          },
        },
      ],
    });

    const output = await tLast30.executeStep("resolve-report-period");

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
    const tCustom = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: {
              preset: "custom" as const,
              start: "2026-01-01",
              end: "2026-01-15",
            },
          },
        },
      ],
    });

    const output = await tCustom.executeStep("resolve-report-period");

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
    const tUnknown = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: { preset: "unknown_preset" as any },
          },
        },
      ],
    });

    const output = await tUnknown.executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toContain("Unknown report period preset");
  });

  it("throws for custom preset when end is missing", async () => {
    const tCustomNoEnd = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: { preset: "custom" as const, start: "2026-01-01" },
          },
        },
      ],
    });

    const output = await tCustomNoEnd.executeStep("resolve-report-period");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toContain("start");
    expect((output.step.error as any)?.message).toContain("end");
  });

  it("throws for custom preset when start is missing", async () => {
    const tCustomNoStart = t.clone({
      events: [
        {
          ...baseEvent,
          data: {
            ...baseEvent.data,
            reportPeriod: { preset: "custom" as const, end: "2026-01-15" },
          },
        },
      ],
    });

    const output = await tCustomNoStart.executeStep("resolve-report-period");

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

    const output = await t.executeStep("fetch-analytics-data");

    expect(output.step.op).toBe("StepError");
    expect((output.step.error as any)?.message).toBe("GA4 API unavailable");
  });
});

// ---------------------------------------------------------------------------
// T014: Happy path — full execute (last_week, all 6 steps)
// ---------------------------------------------------------------------------

describe("full execute — happy path, last_week", () => {
  it("completes all steps and returns the expected result payload", async () => {
    const { result } = await t.execute();

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
    await t.execute();

    expect(mockRenderAnalyticsReport).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: 100, isMock: true }),
      expect.objectContaining({ id: "client-1" }),
      expect.objectContaining({ preset: "last_week" }),
    );
  });

  it("calls sendEmail with client email and resolved period label in subject", async () => {
    await t.execute();

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@example.com",
        subject: expect.stringContaining("Feb 16 \u2013 Feb 22, 2026"),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// T011: check-ga4-config step
// ---------------------------------------------------------------------------

describe("check-ga4-config — client has GA4 property", () => {
  it("does not skip — function completes and sends email", async () => {
    const { result } = await t.execute();

    expect(result).toMatchObject({ clientId: "client-1", outcome: "logged" });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("check-ga4-config — client has no GA4 property, emailMode mock", () => {
  it("returns skipped outcome and does not send email or write log", async () => {
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    const { result } = await freshEngine().execute();

    expect(result).toMatchObject({ clientId: "client-1", outcome: "skipped" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("check-ga4-config — client has no GA4 property, emailMode live", () => {
  it("writes a skipped log record and does not send email", async () => {
    (config as any).emailMode = "live";
    mockGetClientById.mockResolvedValue({ ...mockClient, ga4_property_id: null });

    const { result } = await freshEngine().execute();

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
    await t.execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("log-result — emailMode test", () => {
  it("does not call writeNotificationLog", async () => {
    (config as any).emailMode = "test";

    await t.execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});
