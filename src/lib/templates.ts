import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { render } from '@react-email/render';
import SalesLeadV1Email from '../emails/templates/sales-lead-v1';
import AnalyticsReportV1Email from '../emails/templates/analytics-report-v1';
import {
  generateDailyTrendChart,
  generateTopSourcesGauges,
  generateTopPagesChart,
} from './charts';
import type { ClientBannerConfig } from '../types/index';
import { buildAnalyticsExcel, buildExcelFilename } from './excel';
import { log, logError } from '../utils/logger';
import type { ReportPeriodPreset } from '../types/index';
import type {
  FormSubmittedPayload,
  FormNotificationCtaButton,
  ClientSummary,
  EmailRenderResult,
  EmailAttachment,
  AnalyticsReport,
  ResolvedPeriod,
} from '../types/index';
import type { StatMetric } from '../emails/templates/analytics-report-v1';

/** Maps a raw GA4 sessionSource value to a human-readable traffic category. */
export function categorizeSource(source: string): string {
  const s = source.toLowerCase().trim();
  if (!s || s === 'direct' || s === '(direct)' || s === '(none)' || s === '(not set)') return 'Direct';
  const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'ecosia', 'yandex', 'ask', 'aol', 'brave'];
  if (searchEngines.includes(s) || s.includes('search')) return 'Search';
  const socialPlatforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'reddit', 'youtube', 'snapchat', 'x.com', 't.co', 'threads', 'whatsapp', 'telegram', 'discord'];
  if (socialPlatforms.some(p => s === p || s.includes(p))) return 'Social';
  const emailProviders = ['email', 'newsletter', 'mailchimp', 'klaviyo', 'sendgrid', 'brevo', 'hubspot', 'gmail'];
  if (emailProviders.some(p => s === p || s.includes(p)) || s.includes('mail')) return 'Email';
  return 'Referral';
}

/** Converts a raw URL path to a human-readable page name.
 *  `/` → "Home", `/neighborhoods/the-preserve` → "The Preserve" */
export function pageTitle(path: string): string {
  if (!path || path === '/') return 'Home';
  const segment = path.split('/').filter(Boolean).pop() ?? path;
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function buildReportTitle(preset: ReportPeriodPreset): string {
  switch (preset) {
    case 'last_week':    return 'Weekly Analytics Report';
    case 'last_month':   return 'Monthly Analytics Report';
    case 'last_30_days': return '30-Day Analytics Report';
    case 'last_90_days': return '90-Day Analytics Report';
    case 'custom':       return 'Analytics Report';
  }
}

function shortDate(isoDate: string): string {
  const [, mm, dd] = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mm) - 1]} ${parseInt(dd)}`;
}

/** Formats an ISO date as a bar-chart label sized for the given preset.
 *  - last_week / last_30_days  → MM/DD      (e.g. "01/20") — need month+day to tell periods apart
 *  - last_month                → Mon        (e.g. "Jan")   — single month, name is unambiguous
 *  - last_90_days              → Mon–Mon    (e.g. "Oct–Dec") — 90-day span; show start + end month
 *  - custom                    → ""         (history suppressed for custom ranges)
 */
function formatBarLabel(isoDate: string, preset: ReportPeriodPreset): string {
  const [, mm, dd] = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  switch (preset) {
    case 'last_week':
    case 'last_30_days':
      return `${mm}/${dd}`;
    case 'last_month':
      return months[parseInt(mm) - 1];
    case 'last_90_days': {
      const startDate = new Date(isoDate + 'T00:00:00Z');
      const endDate = new Date(startDate.getTime() + 89 * 86400000);
      const startMon = months[startDate.getUTCMonth()];
      const endMon = months[endDate.getUTCMonth()];
      return startMon === endMon ? startMon : `${startMon}–${endMon}`;
    }
    case 'custom':
      return '';
  }
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

/** Reads client.settings.banner and returns a validated ClientBannerConfig.
 *  Invalid fields are excluded silently; missing/malformed banner key returns {}. */
export function parseBannerConfig(settings: Record<string, unknown>): ClientBannerConfig {
  const raw = settings.banner;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const banner = raw as Record<string, unknown>;
  const config: ClientBannerConfig = {};

  if (typeof banner.imageUrl === 'string') {
    try {
      const parsed = new URL(banner.imageUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        config.imageUrl = banner.imageUrl;
      } else {
        logError('parseBannerConfig: invalid imageUrl protocol (must be http or https)', { field: 'imageUrl', value: banner.imageUrl });
      }
    } catch {
      logError('parseBannerConfig: invalid imageUrl (not a parseable URL)', { field: 'imageUrl', value: banner.imageUrl });
    }
  }

  if (typeof banner.height === 'number') {
    if (Number.isInteger(banner.height) && banner.height > 0) {
      config.height = banner.height;
    } else {
      logError('parseBannerConfig: invalid height (must be a positive integer)', { field: 'height', value: banner.height });
    }
  }

  if (typeof banner.width === 'number') {
    if (Number.isInteger(banner.width) && banner.width > 0) {
      config.width = banner.width;
    } else {
      logError('parseBannerConfig: invalid width (must be a positive integer)', { field: 'width', value: banner.width });
    }
  }

  return config;
}

/** Loads the banner image for embedding as a CID inline attachment.
 *  If imageUrl is provided, fetches from that URL.
 *  Falls back to the local default on fetch failure.
 *  Returns null if both the URL fetch and local file read fail. */
export async function loadBannerAttachment(imageUrl?: string): Promise<EmailAttachment | null> {
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? 'image/png';
      return {
        filename: 'banner_image.png',
        content: buffer.toString('base64'),
        content_id: 'banner_image.png',
        content_type: contentType,
      };
    } catch (err) {
      logError(`loadBannerAttachment: failed to fetch banner from ${imageUrl}`, { url: imageUrl, error: err instanceof Error ? err.message : String(err) });
      // fall through to local file
    }
  }

  try {
    const content = await readFile(path.join(process.cwd(), 'assets', 'banner_image.png'));
    return {
      filename: 'banner_image.png',
      content: content.toString('base64'),
      content_id: 'banner_image.png',
      content_type: 'image/png',
    };
  } catch {
    return null;
  }
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

/** Resolves the CTA button href and label for a form notification email.
 *  Pure function — no side effects except logError() warnings on invalid input. */
export function resolveCta(
  ctaButton: FormNotificationCtaButton | undefined,
  submitterEmail: string | undefined,
  submitterName: string | undefined,
): { ctaHref?: string; ctaLabel?: string } {
  const defaultLabel = submitterName ? `Reply to ${submitterName}` : 'Reply';
  const defaultHref = submitterEmail ? `mailto:${submitterEmail}` : undefined;

  if (!ctaButton) {
    return { ctaHref: defaultHref, ctaLabel: defaultHref ? defaultLabel : undefined };
  }

  let actionHref: string | undefined;
  let usedFallback = false;

  if (!ctaButton.action) {
    actionHref = defaultHref;
  } else if (ctaButton.action.type === 'url') {
    const url = ctaButton.action.url;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      actionHref = url;
    } else {
      logError('resolveCta: invalid URL in ctaButton.action.url — falling back to default mailto', { url });
      actionHref = defaultHref;
      usedFallback = true;
    }
  } else if (ctaButton.action.type === 'mailto') {
    const email = ctaButton.action.email ?? submitterEmail;
    actionHref = email ? `mailto:${email}` : undefined;
  } else {
    logError('resolveCta: unrecognised ctaButton.action.type — falling back to default mailto', { action: ctaButton.action });
    actionHref = defaultHref;
    usedFallback = true;
  }

  const rawText = ctaButton.text?.trim();
  const ctaLabel = (!usedFallback && rawText) ? rawText : defaultLabel;

  return {
    ctaHref: actionHref,
    ctaLabel: actionHref ? ctaLabel : undefined,
  };
}

export async function renderFormNotificationEmail(
  payload: FormSubmittedPayload,
  client: ClientSummary,
): Promise<EmailRenderResult> {
  const bannerConfig = parseBannerConfig(client.settings);
  const banner = await loadBannerAttachment(bannerConfig.imageUrl);
  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const subject = payload.formName
    ? `New form submission: ${payload.formName} — ${client.name}`
    : `New inquiry — ${client.name}`;

  const previewText = payload.submitterName
    ? `New inquiry from ${payload.submitterName}`
    : payload.submitterEmail
    ? `New inquiry from ${payload.submitterEmail}`
    : `New inquiry — ${client.name}`;

  const { ctaHref, ctaLabel } = resolveCta(payload.ctaButton, payload.submitterEmail, payload.submitterName);

  const html = await render(
    SalesLeadV1Email({
      previewText,
      subheader: client.name,
      header: payload.notificationTitle ?? 'New Inquiry',
      customerName: payload.submitterName,
      customerEmail: payload.submitterEmail,
      comments: payload.submitterMessage,
      submittedAt,
      customerPhone: payload.submitterPhone,
      sourcePageLink: payload.submittedFrom,
      sourcePageText: payload.submittedFrom,
      interestedIn: payload.formName,
      customFields: payload.customFields,
      ctaHref,
      ctaLabel,
      bannerHeight: bannerConfig.height,
      bannerWidth: bannerConfig.width,
    }),
  );

  const attachments: EmailAttachment[] = [];
  if (banner) attachments.push(banner);
  const bannerSnapshot = Object.keys(bannerConfig).length > 0 ? bannerConfig : undefined;
  return { subject, html, attachments, banner: bannerSnapshot };
}

export async function renderAnalyticsReportEmail(
  report: AnalyticsReport,
  client: ClientSummary,
  period: ResolvedPeriod,
): Promise<EmailRenderResult> {
  const bannerConfig = parseBannerConfig(client.settings);
  const banner = await loadBannerAttachment(bannerConfig.imageUrl);
  const subject = `Your analytics report — ${period.label}`;
  const previewText = `${client.name} — ${period.label}: ${report.sessions.toLocaleString()} sessions`;

  // custom ranges have no meaningful prior-period comparison — suppress history entirely
  const hp = period.preset === 'custom' ? [] : (report.historicalPeriods ?? []);
  const compLabel = hp.length > 0 ? buildComparisonLabel(period.preset, hp.length) : undefined;
  const currentBarLabel = period.preset !== 'custom' ? formatBarLabel(period.start, period.preset) : '';

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
        ...hp.map(h => ({ label: formatBarLabel(h.periodStart, period.preset), value: priorVals[hp.indexOf(h)], isCurrent: false })),
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

  // Aggregate raw sources into categories for the pie chart.
  // The topSources list is only the top N sources, so we add an "Other" slice
  // for the remaining sessions so that 100% of the pie = total site traffic.
  const categoryTotals: Record<string, number> = {};
  for (const s of report.topSources) {
    const cat = categorizeSource(s.source);
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + s.sessions;
  }
  const totalCategorized = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  const categoryAggregates = Object.entries(categoryTotals)
    .map(([label, sessions]) => ({ label, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
  const otherSessions = report.sessions - totalCategorized;
  if (otherSessions > 0) {
    categoryAggregates.push({ label: 'Other', sessions: otherSessions });
  }

  let sourcesGaugeBufs: Buffer[] = [];
  try {
    sourcesGaugeBufs = await generateTopSourcesGauges(categoryAggregates, report.sessions);
  } catch (e) {
    log(`[charts] top sources gauges failed: ${e}`);
  }

  let pagesChartBuf: Buffer | null = null;
  try {
    pagesChartBuf = await generateTopPagesChart(
      report.topPages.map(p => ({ label: pageTitle(p.path), views: p.views })),
    );
  } catch (e) {
    log(`[charts] top pages chart failed: ${e}`);
  }

  const attachments: EmailAttachment[] = [];
  if (banner) attachments.push(banner);
  if (dailyChartBuf) {
    attachments.push({
      filename: 'chart_daily.png',
      content: dailyChartBuf.toString('base64'),
      content_id: 'chart_daily',
      content_type: 'image/png',
    });
  }
  sourcesGaugeBufs.forEach((buf, i) => {
    attachments.push({
      filename: `chart_sources_${i}.png`,
      content: buf.toString('base64'),
      content_id: `chart_sources_${i}`,
      content_type: 'image/png',
    });
  });
  if (pagesChartBuf) {
    attachments.push({
      filename: 'chart_pages.png',
      content: pagesChartBuf.toString('base64'),
      content_id: 'chart_pages',
      content_type: 'image/png',
    });
  }

  // Generate Excel attachment — non-blocking: failure logs a warning but never prevents email send
  let excelBuf: Buffer | null = null;
  try {
    excelBuf = await buildAnalyticsExcel(report, client, period);
  } catch (e) {
    log(`[excel] workbook generation failed: ${e}`);
  }
  if (excelBuf) {
    attachments.push({
      filename: buildExcelFilename(client, period),
      content: excelBuf,
      content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const html = await render(
    AnalyticsReportV1Email({
      previewText,
      subheader: client.name,
      header: buildReportTitle(period.preset),
      periodLabel: period.label,
      sessions,
      avgDuration,
      activeUsers,
      newUsers,
      topSources: report.topSources.map((s) => ({
        source: s.source,
        category: categorizeSource(s.source),
        sessions: s.sessions.toLocaleString(),
      })),
      topPages: report.topPages.map((p) => ({
        name: pageTitle(p.path),
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
      sourcesGauges: sourcesGaugeBufs.length > 0
        ? sourcesGaugeBufs.map((_, i) => ({
            cid: `cid:chart_sources_${i}`,
            label: categoryAggregates[i]?.label ?? '',
            pct: categoryAggregates[i]
              ? Math.round(categoryAggregates[i].sessions / report.sessions * 100)
              : 0,
            sessions: (categoryAggregates[i]?.sessions ?? 0).toLocaleString(),
          }))
        : undefined,
      pagesChart: pagesChartBuf ? 'cid:chart_pages' : undefined,
      bannerHeight: bannerConfig.height,
      bannerWidth: bannerConfig.width,
    }),
  );

  const bannerSnapshot = Object.keys(bannerConfig).length > 0 ? bannerConfig : undefined;
  return { subject, html, previewText, attachments, banner: bannerSnapshot };
}
