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
import type {
  FormSubmittedPayload,
  ClientRow,
  EmailRenderResult,
  EmailAttachment,
  AnalyticsReport,
  ResolvedPeriod,
} from '../types/index';
import type { StatMetric } from '../emails/templates/analytics-report-v1';

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

  const sessions: StatMetric = {
    value: report.sessions.toLocaleString(),
    label: 'SESSIONS',
    description: `Total sessions — ${period.label}`,
  };
  const avgDuration: StatMetric = {
    value: formatDuration(report.avgSessionDurationSecs),
    label: 'AVG DURATION',
    description: 'Average session duration',
  };
  const activeUsers: StatMetric = {
    value: report.activeUsers.toLocaleString(),
    label: 'ACTIVE USERS',
    description: `Active users — ${period.label}`,
  };
  const newUsers: StatMetric = {
    value: report.newUsers.toLocaleString(),
    label: 'NEW USERS',
    description: `New users — ${period.label}`,
  };

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
      topSources: report.topSources.slice(0, 7).map((s) => ({
        source: s.source,
        sessions: s.sessions.toLocaleString(),
      })),
      topPages: report.topPages.slice(0, 7).map((p) => ({
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
