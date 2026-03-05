import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";
import { config } from "./config";
import { log } from "../utils/logger";
import type {
  AnalyticsReport,
  ResolvedPeriod,
  ReportPeriodPreset,
  TopPage,
  TrafficSource,
  DailyMetric,
} from "../types/index";

// Default row limits per reporting preset.
// Weekly = quick snapshot; monthly/longer = comprehensive view.
const PRESET_LIMITS: Record<ReportPeriodPreset, { sources: number; pages: number }> = {
  last_week:    { sources: 5,  pages: 5  },
  last_month:   { sources: 10, pages: 20 },
  last_30_days: { sources: 10, pages: 20 },
  last_90_days: { sources: 10, pages: 20 },
  custom:       { sources: 10, pages: 10 },
};

export interface AnalyticsReportOptions {
  topSourcesLimit?: number;
  topPagesLimit?: number;
}

type IRunReportResponse =
  protos.google.analytics.data.v1beta.IRunReportResponse;

type IDimension = protos.google.analytics.data.v1beta.IDimension;
type IMetric = protos.google.analytics.data.v1beta.IMetric;
type IOrderBy = protos.google.analytics.data.v1beta.IOrderBy;

interface RunReportArgs {
  propertyId: string;
  startDate: string;
  endDate: string;
  dimensions?: IDimension[];
  metrics?: IMetric[];
  orderBys?: IOrderBy[];
  limit?: number;
}

function createClient(): BetaAnalyticsDataClient {
  return new BetaAnalyticsDataClient({
    credentials: JSON.parse(config.ga4CredentialsJson!),
  });
}

async function runReport(args: RunReportArgs): Promise<IRunReportResponse> {
  const client = createClient();
  const [response] = await client.runReport({
    property: `properties/${args.propertyId}`,
    dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
    dimensions: args.dimensions ?? [],
    metrics: args.metrics ?? [],
    orderBys: args.orderBys ?? [],
    ...(args.limit ? { limit: args.limit } : {}),
  } as any);
  return response;
}

async function getReportData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<IRunReportResponse> {
  return runReport({
    propertyId,
    startDate,
    endDate,
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "newUsers" },
    ],
    dimensions: [{ name: "date" }],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
  });
}

async function getAverageSessionDuration(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<IRunReportResponse> {
  return runReport({
    propertyId,
    startDate,
    endDate,
    metrics: [{ name: "averageSessionDuration" }],
  });
}

async function getTrafficSourceData(
  propertyId: string,
  startDate: string,
  endDate: string,
  limit = 5
): Promise<IRunReportResponse> {
  return runReport({
    propertyId,
    startDate,
    endDate,
    dimensions: [{ name: "sessionSource" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });
}

async function getMostViewedPagesData(
  propertyId: string,
  startDate: string,
  endDate: string,
  limit = 5
): Promise<IRunReportResponse> {
  return runReport({
    propertyId,
    startDate,
    endDate,
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });
}

function metricVal(
  response: IRunReportResponse,
  rowIndex: number,
  metricIndex: number
): number {
  const val = response.rows?.[rowIndex]?.metricValues?.[metricIndex]?.value;
  return val ? parseFloat(val) : 0;
}

function dimVal(
  response: IRunReportResponse,
  rowIndex: number,
  dimIndex: number
): string {
  return response.rows?.[rowIndex]?.dimensionValues?.[dimIndex]?.value ?? "";
}

function mockReport(period: ResolvedPeriod): AnalyticsReport {
  return {
    sessions: 42,
    activeUsers: 31,
    newUsers: 18,
    avgSessionDurationSecs: 154,
    topPages: [
      { path: "/", views: 120 },
      { path: "/about", views: 45 },
      { path: "/contact", views: 30 },
    ],
    topSources: [
      { source: "google", sessions: 20 },
      { source: "direct", sessions: 15 },
      { source: "(none)", sessions: 7 },
    ],
    dailyMetrics: [
      { date: period.start, sessions: 6, activeUsers: 5, newUsers: 3 },
    ],
    resolvedPeriod: period,
    isMock: true,
  };
}

export async function getAnalyticsReport(
  propertyId: string,
  period: ResolvedPeriod,
  options: AnalyticsReportOptions = {}
): Promise<AnalyticsReport> {
  if (!config.ga4CredentialsJson) {
    log("[analytics] GA4_SERVICE_ACCOUNT_JSON not set — returning mock data");
    return mockReport(period);
  }

  const defaults = PRESET_LIMITS[period.preset];
  const sourcesLimit = options.topSourcesLimit ?? defaults.sources;
  const pagesLimit = options.topPagesLimit ?? defaults.pages;
  const { start, end } = period;

  const [dailyData, durationData, sourcesData, pagesData] = await Promise.all([
    getReportData(propertyId, start, end),
    getAverageSessionDuration(propertyId, start, end),
    getTrafficSourceData(propertyId, start, end, sourcesLimit),
    getMostViewedPagesData(propertyId, start, end, pagesLimit),
  ]);

  // Aggregate sessions/users/newUsers from daily rows
  let sessions = 0;
  let activeUsers = 0;
  let newUsers = 0;
  const dailyMetrics: DailyMetric[] = [];

  for (let i = 0; i < (dailyData.rows?.length ?? 0); i++) {
    const s = Math.round(metricVal(dailyData, i, 0));
    const a = Math.round(metricVal(dailyData, i, 1));
    const n = Math.round(metricVal(dailyData, i, 2));
    sessions += s;
    activeUsers += a;
    newUsers += n;
    dailyMetrics.push({
      date: dimVal(dailyData, i, 0),
      sessions: s,
      activeUsers: a,
      newUsers: n,
    });
  }

  const avgSessionDurationSecs = Math.round(
    metricVal(durationData, 0, 0)
  );

  const topSources: TrafficSource[] = (sourcesData.rows ?? []).map(
    (row, i) => ({
      source: dimVal(sourcesData, i, 0),
      sessions: Math.round(metricVal(sourcesData, i, 0)),
    })
  );

  const topPages: TopPage[] = (pagesData.rows ?? []).map((row, i) => ({
    path: dimVal(pagesData, i, 0),
    views: Math.round(metricVal(pagesData, i, 0)),
  }));

  return {
    sessions,
    activeUsers,
    newUsers,
    avgSessionDurationSecs,
    topPages,
    topSources,
    dailyMetrics,
    resolvedPeriod: period,
    isMock: false,
  };
}
