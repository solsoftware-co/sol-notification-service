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

    // Prior period stub — each getPeriodTotals() makes 2 calls (totals + duration)
    const priorTotalsResponse = { rows: [makeRow([], ["3000", "2100", "400"])] };
    const priorDurationResponse = { rows: [makeRow([], ["150"])] };

    mockRunReport
      .mockResolvedValueOnce([dailyResponse])       // call 1: getReportData
      .mockResolvedValueOnce([durationResponse])    // call 2: getAverageSessionDuration (main)
      .mockResolvedValueOnce([sourcesResponse])     // call 3: getTrafficSourceData
      .mockResolvedValueOnce([pagesResponse])       // call 4: getMostViewedPagesData
      // Prior period 1 — oldest
      .mockResolvedValueOnce([priorTotalsResponse])    // call 5
      .mockResolvedValueOnce([priorDurationResponse])  // call 6
      // Prior period 2
      .mockResolvedValueOnce([priorTotalsResponse])    // call 7
      .mockResolvedValueOnce([priorDurationResponse])  // call 8
      // Prior period 3 — most recent prior
      .mockResolvedValueOnce([priorTotalsResponse])    // call 9
      .mockResolvedValueOnce([priorDurationResponse]); // call 10

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
    expect(report.historicalPeriods).toHaveLength(3);
    expect(mockRunReport).toHaveBeenCalledTimes(10); // 4 main + 2 per prior period × 3
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
  // historicalPeriods
  describe('historicalPeriods', () => {
    it('mock mode — returns 3 pre-defined historical period entries', async () => {
      vi.mocked(config).ga4CredentialsJson = null; // reset in case a prior test mutated it
      const report = await getAnalyticsReport("123456789", mockPeriod);

      expect(report.isMock).toBe(true);
      expect(report.historicalPeriods).toHaveLength(3);
      report.historicalPeriods!.forEach(h => {
        expect(h).toHaveProperty('periodLabel');
        expect(h).toHaveProperty('sessions');
        expect(h).toHaveProperty('activeUsers');
        expect(h).toHaveProperty('newUsers');
        expect(h).toHaveProperty('avgSessionDurationSecs');
      });
    });

    it('live mode — historicalPeriods contains summaries for all 3 prior periods', async () => {
      vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
      const emptyMain = { rows: [] };
      const priorTotals = { rows: [makeRow([], ["5000", "3500", "600"])] };
      const priorDuration = { rows: [makeRow([], ["175"])] };

      mockRunReport
        .mockResolvedValueOnce([emptyMain])     // getReportData
        .mockResolvedValueOnce([emptyMain])     // getAverageSessionDuration (main)
        .mockResolvedValueOnce([emptyMain])     // getTrafficSourceData
        .mockResolvedValueOnce([emptyMain])     // getMostViewedPagesData
        .mockResolvedValueOnce([priorTotals])   // period 1 — totals
        .mockResolvedValueOnce([priorDuration]) // period 1 — duration
        .mockResolvedValueOnce([priorTotals])   // period 2 — totals
        .mockResolvedValueOnce([priorDuration]) // period 2 — duration
        .mockResolvedValueOnce([priorTotals])   // period 3 — totals
        .mockResolvedValueOnce([priorDuration]);// period 3 — duration

      const report = await getAnalyticsReport("123456789", mockPeriod);

      expect(report.isMock).toBe(false);
      expect(report.historicalPeriods).toHaveLength(3);
      expect(report.historicalPeriods![0].sessions).toBe(5000);
      expect(report.historicalPeriods![0].activeUsers).toBe(3500);
      expect(report.historicalPeriods![0].newUsers).toBe(600);
      expect(report.historicalPeriods![0].avgSessionDurationSecs).toBe(175);
      expect(typeof report.historicalPeriods![0].periodLabel).toBe('string');
      expect(report.historicalPeriods![0].periodLabel.length).toBeGreaterThan(0);
    });

    it('live mode — a failed prior period fetch is gracefully excluded', async () => {
      vi.mocked(config).ga4CredentialsJson = '{"type":"service_account"}';
      const emptyMain = { rows: [] };
      const priorTotals = { rows: [makeRow([], ["4000", "2800", "500"])] };
      const priorDuration = { rows: [makeRow([], ["160"])] };

      mockRunReport
        .mockResolvedValueOnce([emptyMain])       // getReportData
        .mockResolvedValueOnce([emptyMain])       // getAverageSessionDuration (main)
        .mockResolvedValueOnce([emptyMain])       // getTrafficSourceData
        .mockResolvedValueOnce([emptyMain])       // getMostViewedPagesData
        .mockResolvedValueOnce([priorTotals])     // period 1 — totals ✓
        .mockResolvedValueOnce([priorDuration])   // period 1 — duration ✓
        .mockRejectedValueOnce(new Error("GA4 quota exceeded")) // period 2 — totals ✗
        .mockResolvedValueOnce([priorDuration])   // period 2 — duration (initiated before rejection resolves; result ignored)
        .mockResolvedValueOnce([priorTotals])     // period 3 — totals ✓
        .mockResolvedValueOnce([priorDuration]);  // period 3 — duration ✓

      const report = await getAnalyticsReport("123456789", mockPeriod);

      // Only the 2 successful periods make it into historicalPeriods
      expect(report.historicalPeriods).toHaveLength(2);
      expect(report.isMock).toBe(false);
    });
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
