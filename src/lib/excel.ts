import * as XLSX from 'xlsx';
import type { AnalyticsReport, ClientSummary, ResolvedPeriod } from '../types/index';

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function buildExcelFilename(client: ClientSummary, period: ResolvedPeriod): string {
  const slug = client.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `analytics-${slug}-${period.start}-${period.end}.xlsx`;
}

export async function buildAnalyticsExcel(
  report: AnalyticsReport,
  client: ClientSummary,
  period: ResolvedPeriod,
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['Report Period', period.label],
    ['Date Range', `${period.start} to ${period.end}`],
    ['Total Sessions', report.sessions],
    ['Active Users', report.activeUsers],
    ['New Users', report.newUsers],
    ['Avg Session Duration', formatDuration(report.avgSessionDurationSecs)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

  // Sheet 2: Top Pages
  const pagesData: (string | number)[][] = [
    ['Page Path', 'Page Views'],
    ...report.topPages.map((p) => [p.path, p.views]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pagesData), 'Top Pages');

  // Sheet 3: Traffic Sources
  const sourcesData: (string | number)[][] = [
    ['Source', 'Sessions'],
    ...report.topSources.map((s) => [s.source, s.sessions]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sourcesData), 'Traffic Sources');

  // Sheet 4: Daily Breakdown
  const dailyData: (string | number)[][] = [
    ['Date', 'Sessions', 'Active Users', 'New Users'],
    ...report.dailyMetrics.map((d) => [d.date, d.sessions, d.activeUsers, d.newUsers]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), 'Daily Breakdown');

  // Sheet 5: Historical (conditional)
  if (
    report.historicalPeriods &&
    report.historicalPeriods.length > 0 &&
    period.preset !== 'custom'
  ) {
    const historicalData: (string | number)[][] = [
      ['Period', 'Sessions', 'Active Users', 'New Users', 'Avg Session Duration'],
      ...report.historicalPeriods.map((h) => [
        h.periodLabel,
        h.sessions,
        h.activeUsers,
        h.newUsers,
        formatDuration(h.avgSessionDurationSecs),
      ]),
      [
        'Current Period',
        report.sessions,
        report.activeUsers,
        report.newUsers,
        formatDuration(report.avgSessionDurationSecs),
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(historicalData), 'Historical');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
