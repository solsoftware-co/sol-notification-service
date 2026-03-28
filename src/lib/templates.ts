import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { render } from '@react-email/render';
import SalesLeadV1Email from '../emails/templates/sales-lead-v1';
import AnalyticsReportV1Email from '../emails/templates/analytics-report-v1';
import {
  generateDailyTrendChart,
  generateTopSourcesChart,
  generateTopPagesChart,
} from './charts';
import { log } from '../utils/logger';
import type { ReportPeriodPreset } from '../types/index';
import type {
  FormSubmittedPayload,
  ClientRow,
  EmailRenderResult,
  EmailAttachment,
  AnalyticsReport,
  ResolvedPeriod,
} from '../types/index';
import type { StatMetric } from '../emails/templates/analytics-report-v1';

function shortDate(isoDate: string): string {
  const [, mm, dd] = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mm) - 1]} ${parseInt(dd)}`;
}

function computeChange(current: number, priors: number[]): { pct: number; direction: 'up' | 'down' | 'neutral' } {
  if (priors.length === 0) return { pct: 0, direction: 'neutral' };
  const avg = priors.reduce((s, v) => s + v, 0) / priors.length;
  if (avg === 0) return { pct: 0, direction: 'neutral' };
  const ratio = (current - avg) / avg;
  return {
    pct: Math.round(Math.abs(ratio) * 100),
    direction: ratio > 0.01 ? 'up' : ratio < -0.01 ? 'down' : 'neutral',
  };
}

function buildChangePhrase(
  metricKey: 'sessions' | 'activeUsers' | 'newUsers' | 'avgDuration',
  pct: number,
  direction: 'up' | 'down' | 'neutral',
): string {
  if (direction === 'neutral') {
    const noun = metricKey === 'sessions' ? 'sessions' :
                 metricKey === 'activeUsers' ? 'active users' :
                 metricKey === 'newUsers' ? 'new users' : 'session duration';
    return `consistent ${noun}`;
  }
  switch (metricKey) {
    case 'sessions':    return `${pct}% ${direction === 'up' ? 'more' : 'fewer'} sessions`;
    case 'activeUsers': return `${pct}% ${direction === 'up' ? 'more' : 'fewer'} active users`;
    case 'newUsers':    return `${pct}% ${direction === 'up' ? 'more' : 'fewer'} new users`;
    case 'avgDuration': return `${pct}% ${direction === 'up' ? 'longer' : 'shorter'} average sessions`;
  }
}

function buildComparisonLabel(preset: ReportPeriodPreset, count: number): string {
  const unit = preset === 'last_week'    ? 'week' :
               preset === 'last_month'   ? 'month' :
               preset === 'last_30_days' ? '30-day period' :
               preset === 'last_90_days' ? '90-day period' : 'period';
  return count === 1 ? `the previous ${unit}` : `the previous ${count} ${unit}s`;
}

async function loadBannerAttachment(): Promise<EmailAttachment> {
  const content = await readFile(path.join(process.cwd(), 'assets', 'banner_image.png'));
  return {
    filename: 'banner_image.png',
    content: content.toString('base64'),
    content_id: 'banner_image.png',
    content_type: 'image/png',
  };
}

function formatDateMDY(date: string): string {
  // GA4 returns "YYYYMMDD"; ISO format is "YYYY-MM-DD" — normalise to "MM/DD/YYYY"
  const s = date.includes('-') ? date : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const [yyyy, mm, dd] = s.split('-');
  return `${mm}/${dd}/${yyyy}`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function renderFormNotificationEmail(
  payload: FormSubmittedPayload,
  client: ClientRow,
): Promise<EmailRenderResult> {
  const banner = await loadBannerAttachment();
  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const subject = payload.formId
    ? `New form submission: ${payload.formId} — ${client.name}`
    : `New inquiry — ${client.name}`;

  const html = await render(
    SalesLeadV1Email({
      previewText: `New inquiry from ${payload.submitterName}`,
      subheader: client.name,
      header: 'New Inquiry',
      customerName: payload.submitterName,
      customerEmail: payload.submitterEmail,
      comments: payload.submitterMessage,
      submittedAt,
      interestedIn: payload.formId,
    }),
  );

  return { subject, html, attachments: [banner] };
}

export async function renderAnalyticsReportEmail(
  report: AnalyticsReport,
  client: ClientRow,
  period: ResolvedPeriod,
): Promise<EmailRenderResult> {
  const banner = await loadBannerAttachment();
  const subject = `Your analytics report — ${period.label}`;
  const previewText = `${client.name} — ${period.label}: ${report.sessions.toLocaleString()} sessions`;

  const hp = report.historicalPeriods ?? [];
  const compLabel = hp.length > 0 ? buildComparisonLabel(period.preset, hp.length) : undefined;
  const currentBarLabel = shortDate(period.start);

  function buildMetric(
    metricKey: 'sessions' | 'activeUsers' | 'newUsers' | 'avgDuration',
    label: string,
    sublabel: string,
    currentVal: number,
    formattedValue: string,
  ): StatMetric {
    if (hp.length === 0) return { value: formattedValue, label, sublabel };
    const priorVals = hp.map(h =>
      metricKey === 'sessions'    ? h.sessions :
      metricKey === 'activeUsers' ? h.activeUsers :
      metricKey === 'newUsers'    ? h.newUsers : h.avgSessionDurationSecs
    );
    const { pct, direction } = computeChange(currentVal, priorVals);
    return {
      value: formattedValue,
      label,
      sublabel,
      changePhrase: buildChangePhrase(metricKey, pct, direction),
      changeDirection: direction,
      periodLabel: period.label,
      comparisonLabel: compLabel,
      bars: [
        ...hp.map(h => ({ label: h.periodLabel, value: priorVals[hp.indexOf(h)], isCurrent: false })),
        { label: currentBarLabel, value: currentVal, isCurrent: true },
      ],
    };
  }

  const sessions    = buildMetric('sessions',    'Website Visits',      'Sessions',     report.sessions,               report.sessions.toLocaleString());
  const avgDuration = buildMetric('avgDuration', 'Avg. Time on Site',   'Avg. Duration', report.avgSessionDurationSecs, formatDuration(report.avgSessionDurationSecs));
  const activeUsers = buildMetric('activeUsers', 'Total Visitors',      'Active Users', report.activeUsers,            report.activeUsers.toLocaleString());
  const newUsers    = buildMetric('newUsers',    'First-Time Visitors', 'New Users',    report.newUsers,               report.newUsers.toLocaleString());

  // Generate charts independently — each fails gracefully without blocking the others
  let dailyChartBuf: Buffer | null = null;
  try {
    dailyChartBuf = await generateDailyTrendChart(report.dailyMetrics);
  } catch (e) {
    log(`[charts] daily trend chart failed: ${e}`);
  }

  let sourcesChartBuf: Buffer | null = null;
  try {
    sourcesChartBuf = await generateTopSourcesChart(report.topSources);
  } catch (e) {
    log(`[charts] top sources chart failed: ${e}`);
  }

  let pagesChartBuf: Buffer | null = null;
  try {
    pagesChartBuf = await generateTopPagesChart(report.topPages);
  } catch (e) {
    log(`[charts] top pages chart failed: ${e}`);
  }

  const attachments: EmailAttachment[] = [banner];
  if (dailyChartBuf) {
    attachments.push({
      filename: 'chart_daily.png',
      content: dailyChartBuf.toString('base64'),
      content_id: 'chart_daily',
      content_type: 'image/png',
    });
  }
  if (sourcesChartBuf) {
    attachments.push({
      filename: 'chart_sources.png',
      content: sourcesChartBuf.toString('base64'),
      content_id: 'chart_sources',
      content_type: 'image/png',
    });
  }
  if (pagesChartBuf) {
    attachments.push({
      filename: 'chart_pages.png',
      content: pagesChartBuf.toString('base64'),
      content_id: 'chart_pages',
      content_type: 'image/png',
    });
  }

  const html = await render(
    AnalyticsReportV1Email({
      previewText,
      subheader: client.name,
      header: 'Weekly Analytics Report',
      periodLabel: period.label,
      sessions,
      avgDuration,
      activeUsers,
      newUsers,
      topSources: report.topSources.map((s) => ({
        source: s.source,
        sessions: s.sessions.toLocaleString(),
      })),
      topPages: report.topPages.map((p) => ({
        path: p.path,
        views: p.views.toLocaleString(),
      })),
      dailyMetrics: report.dailyMetrics.map((d) => ({
        date: formatDateMDY(d.date),
        sessions: d.sessions.toLocaleString(),
        activeUsers: d.activeUsers.toLocaleString(),
        newUsers: d.newUsers.toLocaleString(),
      })),
      dailyChart: dailyChartBuf ? 'cid:chart_daily' : undefined,
      sourcesChart: sourcesChartBuf ? 'cid:chart_sources' : undefined,
      pagesChart: pagesChartBuf ? 'cid:chart_pages' : undefined,
    }),
  );

  return { subject, html, previewText, attachments };
}
