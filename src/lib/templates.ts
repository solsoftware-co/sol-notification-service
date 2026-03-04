import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { render } from '@react-email/render';
import SalesLeadV1Email from '../emails/templates/sales-lead-v1';
import AnalyticsReportV1Email from '../emails/templates/analytics-report-v1';
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
    content,
    headers: { 'Content-ID': '<banner_image.png>' },
  };
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
        date: d.date,
        sessions: d.sessions.toLocaleString(),
        activeUsers: d.activeUsers.toLocaleString(),
        newUsers: d.newUsers.toLocaleString(),
      })),
      charts: [],
    }),
  );

  return { subject, html, previewText, attachments: [banner] };
}
