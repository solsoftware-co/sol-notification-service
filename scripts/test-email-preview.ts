import { writeFileSync, mkdirSync } from 'node:fs';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { renderFormNotificationEmail, renderAnalyticsReportEmail } from '../src/lib/templates';
import type { FormSubmittedPayload, ClientRow, AnalyticsReport, ResolvedPeriod } from '../src/types/index';

const PREVIEW_DIR = join(process.cwd(), '.email-preview');

// Replace CID references with base64 data URIs so images render in browsers
function inlineImages(html: string, attachments: Array<{ content_id?: string; content_type?: string; content: Buffer | string }>): string {
  let result = html;
  for (const att of attachments) {
    if (att.content_id && att.content_type) {
      const b64 = Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content;
      result = result.replaceAll(`cid:${att.content_id}`, `data:${att.content_type};base64,${b64}`);
    }
  }
  return result;
}

function openInBrowser(filePath: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${filePath}"`);
}

const mockClient: ClientRow = {
  id: 'acme',
  name: 'Acme Corp',
  email: 'hello@acmecorp.com',
  ga4_property_id: 'properties/123456789',
  active: true,
  settings: {},
  created_at: new Date(),
};

async function previewInquiry() {
  const payload: FormSubmittedPayload = {
    clientId: 'acme',
    submitterName: 'Casey Ramirez',
    submitterEmail: 'casey@example.com',
    submitterMessage: 'Hi,\n\nI\'m interested in learning more about your web development services for our upcoming project.\n\nWe\'re looking for a team to help us redesign our customer portal and integrate with our existing backend.\n\nLooking forward to hearing from you!\n\nCasey',
    formId: 'Contact Form',
  };

  const rendered = await renderFormNotificationEmail(payload, mockClient);
  const filePath = join(PREVIEW_DIR, 'inquiry.html');
  writeFileSync(filePath, inlineImages(rendered.html, rendered.attachments), 'utf-8');
  openInBrowser(filePath);
  console.log('Inquiry preview written → .email-preview/inquiry.html');
}

async function previewAnalytics() {
  const period: ResolvedPeriod = {
    start: '2026-02-23',
    end: '2026-03-01',
    label: 'Feb 23 – Mar 1, 2026',
    preset: 'last_week',
  };

  const report: AnalyticsReport = {
    sessions: 12340,
    activeUsers: 8900,
    newUsers: 1240,
    avgSessionDurationSecs: 154,
    resolvedPeriod: period,
    isMock: true,
    topSources: [
      { source: 'google', sessions: 4820 },
      { source: 'direct', sessions: 3210 },
      { source: 'linkedin.com', sessions: 1540 },
      { source: 'twitter.com', sessions: 890 },
      { source: 'newsletter', sessions: 670 },
    ],
    topPages: [
      { path: '/', views: 5430 },
      { path: '/services', views: 3120 },
      { path: '/about', views: 1870 },
      { path: '/contact', views: 1240 },
      { path: '/case-studies', views: 980 },
      { path: '/blog', views: 750 },
      { path: '/pricing', views: 620 },
    ],
    dailyMetrics: [
      { date: '2026-02-23', sessions: 1540, activeUsers: 1120, newUsers: 180 },
      { date: '2026-02-24', sessions: 1820, activeUsers: 1310, newUsers: 210 },
      { date: '2026-02-25', sessions: 1920, activeUsers: 1390, newUsers: 195 },
      { date: '2026-02-26', sessions: 1750, activeUsers: 1260, newUsers: 165 },
      { date: '2026-02-27', sessions: 1680, activeUsers: 1210, newUsers: 170 },
      { date: '2026-02-28', sessions: 1890, activeUsers: 1360, newUsers: 205 },
      { date: '2026-03-01', sessions: 1740, activeUsers: 1250, newUsers: 115 },
    ],
  };

  const rendered = await renderAnalyticsReportEmail(report, mockClient, period);
  const filePath = join(PREVIEW_DIR, 'analytics.html');
  writeFileSync(filePath, inlineImages(rendered.html, rendered.attachments), 'utf-8');
  openInBrowser(filePath);
  console.log('Analytics preview written → .email-preview/analytics.html');
}

async function main() {
  mkdirSync(PREVIEW_DIR, { recursive: true });
  await previewInquiry();
  await previewAnalytics();
}

main().catch((err) => {
  console.error('Preview failed:', err.message);
  process.exit(1);
});
