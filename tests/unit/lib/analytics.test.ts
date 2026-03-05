// T012 + T017: analytics module unit tests
// Mocks @google-analytics/data so no real GA4 calls are made.

const mockRunReport = vi.hoisted(() => vi.fn());

vi.mock("@google-analytics/data", () => ({
  BetaAnalyticsDataClient: vi.fn().mockImplementation(() => ({
    runReport: mockRunReport,
  })),
  protos: {
    google: {
      analytics: {
        data: {
          v1beta: {},
        },
      },
    },
  },
}));

vi.mock("../../../src/lib/config", () => ({
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

vi.mock("../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));

import { getAnalyticsReport } from "../../../src/lib/analytics";
import type { ResolvedPeriod } from "../../../src/types/index";
import { config } from "../../../src/lib/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const mockPeriod: ResolvedPeriod = {
  start: "2026-02-16",
  end: "2026-02-22",
  label: "Feb 16 – Feb 22, 2026",
  preset: "last_week",
};

// Helpers to build GA4-style response rows
function makeRow(dims: string[], metrics: string[]) {
  return {
    dimensionValues: dims.map((v) => ({ value: v })),
    metricValues: metrics.map((v) => ({ value: v })),
  };
}

describe("getAnalyticsReport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // vi.resetAllMocks() clears the constructor's mockImplementation, so re-apply it.
    vi.mocked(BetaAnalyticsDataClient).mockImplementation(
      () => ({ runReport: mockRunReport }) as any
    );
  });

  // -------------------------------------------------------------------------
  it("mock mode — returns AnalyticsReport with isMock:true, SDK never instantiated", async () => {
    // config.ga4CredentialsJson is null (default mock)
    const report = await getAnalyticsReport("123456789", mockPeriod);

    expect(report.isMock).toBe(true);
    expect(report.sessions).toBeGreaterThan(0);
    expect(report.resolvedPeriod).toEqual(mockPeriod);
    expect(BetaAnalyticsDataClient).not.toHaveBeenCalled();
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it("live mode — calls all 4 runReport variants and returns parsed AnalyticsReport", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';

    // Daily report: 2 rows, metrics: sessions / activeUsers / newUsers
    const dailyResponse = {
      rows: [
        makeRow(["20260216"], ["10", "8", "4"]),
        makeRow(["20260217"], ["15", "12", "6"]),
      ],
    };
    // Avg duration: single aggregate row
    const durationResponse = { rows: [makeRow([], ["154.5"])] };
    // Traffic sources: 2 rows
    const sourcesResponse = {
      rows: [
        makeRow(["google"], ["18"]),
        makeRow(["direct"], ["7"]),
      ],
    };
    // Top pages: 2 rows
    const pagesResponse = {
      rows: [
        makeRow(["/"], ["90"]),
        makeRow(["/about"], ["30"]),
      ],
    };

    mockRunReport
      .mockResolvedValueOnce([dailyResponse])    // getReportData
      .mockResolvedValueOnce([durationResponse]) // getAverageSessionDuration
      .mockResolvedValueOnce([sourcesResponse])  // getTrafficSourceData
      .mockResolvedValueOnce([pagesResponse]);   // getMostViewedPagesData

    const report = await getAnalyticsReport("123456789", mockPeriod);

    expect(report.isMock).toBe(false);
    expect(report.sessions).toBe(25);       // 10 + 15
    expect(report.activeUsers).toBe(20);    // 8 + 12
    expect(report.newUsers).toBe(10);       // 4 + 6
    expect(report.avgSessionDurationSecs).toBe(155); // rounded from 154.5
    expect(report.topSources).toHaveLength(2);
    expect(report.topSources[0].source).toBe("google");
    expect(report.topSources[0].sessions).toBe(18);
    expect(report.topPages).toHaveLength(2);
    expect(report.topPages[0].path).toBe("/");
    expect(report.topPages[0].views).toBe(90);
    expect(report.dailyMetrics).toHaveLength(2);
    expect(report.resolvedPeriod).toEqual(mockPeriod);
    expect(mockRunReport).toHaveBeenCalledTimes(4);
  });

  // -------------------------------------------------------------------------
  it("zero-traffic — empty rows returns zeros and empty lists", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';

    const emptyResponse = { rows: [] };

    mockRunReport
      .mockResolvedValueOnce([emptyResponse])
      .mockResolvedValueOnce([emptyResponse])
      .mockResolvedValueOnce([emptyResponse])
      .mockResolvedValueOnce([emptyResponse]);

    const report = await getAnalyticsReport("123456789", mockPeriod);

    expect(report.sessions).toBe(0);
    expect(report.activeUsers).toBe(0);
    expect(report.newUsers).toBe(0);
    expect(report.avgSessionDurationSecs).toBe(0);
    expect(report.topPages).toEqual([]);
    expect(report.topSources).toEqual([]);
    expect(report.dailyMetrics).toEqual([]);
    expect(report.isMock).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Per-preset default limits
  it("last_week preset — uses 5 sources and 5 pages by default", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
    const emptyResponse = { rows: [] };
    mockRunReport.mockResolvedValue([emptyResponse]);

    await getAnalyticsReport("123456789", { ...mockPeriod, preset: "last_week" });

    const sourcesCall = mockRunReport.mock.calls[2][0];
    const pagesCall   = mockRunReport.mock.calls[3][0];
    expect(sourcesCall.limit).toBe(5);
    expect(pagesCall.limit).toBe(5);
  });

  it("last_month preset — uses 10 sources and 20 pages by default", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
    const emptyResponse = { rows: [] };
    mockRunReport.mockResolvedValue([emptyResponse]);

    await getAnalyticsReport("123456789", { ...mockPeriod, preset: "last_month" });

    const sourcesCall = mockRunReport.mock.calls[2][0];
    const pagesCall   = mockRunReport.mock.calls[3][0];
    expect(sourcesCall.limit).toBe(10);
    expect(pagesCall.limit).toBe(20);
  });

  it("last_30_days preset — uses 10 sources and 20 pages by default", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
    const emptyResponse = { rows: [] };
    mockRunReport.mockResolvedValue([emptyResponse]);

    await getAnalyticsReport("123456789", { ...mockPeriod, preset: "last_30_days" });

    const sourcesCall = mockRunReport.mock.calls[2][0];
    const pagesCall   = mockRunReport.mock.calls[3][0];
    expect(sourcesCall.limit).toBe(10);
    expect(pagesCall.limit).toBe(20);
  });

  // -------------------------------------------------------------------------
  // Custom limit overrides
  it("custom topSourcesLimit overrides the preset default", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
    const emptyResponse = { rows: [] };
    mockRunReport.mockResolvedValue([emptyResponse]);

    await getAnalyticsReport("123456789", { ...mockPeriod, preset: "last_week" }, { topSourcesLimit: 15 });

    const sourcesCall = mockRunReport.mock.calls[2][0];
    const pagesCall   = mockRunReport.mock.calls[3][0];
    expect(sourcesCall.limit).toBe(15); // overridden
    expect(pagesCall.limit).toBe(5);    // still using preset default
  });

  it("custom topPagesLimit overrides the preset default", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
    const emptyResponse = { rows: [] };
    mockRunReport.mockResolvedValue([emptyResponse]);

    await getAnalyticsReport("123456789", { ...mockPeriod, preset: "last_month" }, { topPagesLimit: 3 });

    const sourcesCall = mockRunReport.mock.calls[2][0];
    const pagesCall   = mockRunReport.mock.calls[3][0];
    expect(sourcesCall.limit).toBe(10); // still using preset default
    expect(pagesCall.limit).toBe(3);    // overridden
  });

  // -------------------------------------------------------------------------
  // T017: GA4 error propagation
  it("live mode — SDK error propagates and is not swallowed", async () => {
    vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';

    mockRunReport.mockRejectedValue(new Error("GA4 API unavailable"));

    await expect(getAnalyticsReport("123456789", mockPeriod)).rejects.toThrow(
      "GA4 API unavailable"
    );
  });
});
