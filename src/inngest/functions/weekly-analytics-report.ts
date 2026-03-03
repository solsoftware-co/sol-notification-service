import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById } from "../../lib/db";
import { getAnalyticsReport } from "../../lib/analytics";
import { sendEmail } from "../../lib/email";
import { log } from "../../utils/logger";
import type {
  AnalyticsReportRequestedPayload,
  ResolvedPeriod,
  ReportPeriod,
  AnalyticsReport,
} from "../../types/index";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sLabel = `${MONTH_ABBR[s.getUTCMonth()]} ${s.getUTCDate()}`;
  const eLabel = `${MONTH_ABBR[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  return `${sLabel} – ${eLabel}`;
}

function resolvePeriod(period: ReportPeriod, scheduledAt: string): ResolvedPeriod {
  const ref = new Date(scheduledAt);
  let start: string;
  let end: string;

  switch (period.preset) {
    case "last_week": {
      // Tuesday cron: yesterday = Monday, last Sunday = -2 days, last Monday = -8 days
      end = toDateStr(subtractDays(ref, 2));
      start = toDateStr(subtractDays(ref, 8));
      break;
    }
    case "last_month": {
      const y = ref.getUTCFullYear();
      const m = ref.getUTCMonth(); // 0-indexed current month
      // First day of previous month
      const firstDay = new Date(Date.UTC(y, m - 1, 1));
      // Last day of previous month: day 0 of current month
      const lastDay = new Date(Date.UTC(y, m, 0));
      start = toDateStr(firstDay);
      end = toDateStr(lastDay);
      break;
    }
    case "last_30_days": {
      const yesterday = subtractDays(ref, 1);
      end = toDateStr(yesterday);
      start = toDateStr(subtractDays(yesterday, 29));
      break;
    }
    case "last_90_days": {
      const yesterday = subtractDays(ref, 1);
      end = toDateStr(yesterday);
      start = toDateStr(subtractDays(yesterday, 89));
      break;
    }
    case "custom": {
      if (!period.start || !period.end) {
        throw new Error(
          `Custom report period requires both "start" and "end" date fields`
        );
      }
      start = period.start;
      end = period.end;
      break;
    }
    default: {
      throw new Error(`Unknown report period preset: ${(period as any).preset}`);
    }
  }

  return { start, end, label: formatLabel(start, end), preset: period.preset };
}

// ---------------------------------------------------------------------------
// Email builder
// ---------------------------------------------------------------------------

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function buildReportEmail(
  clientName: string,
  report: AnalyticsReport
): string {
  const { resolvedPeriod: p } = report;

  const topSourcesRows = report.topSources
    .map(
      (src) =>
        `<tr><td style="padding:6px 12px 6px 0;">${src.source}</td><td style="padding:6px 0;text-align:right;">${src.sessions.toLocaleString()}</td></tr>`
    )
    .join("");

  const topPagesRows = report.topPages
    .map(
      (pg) =>
        `<tr><td style="padding:6px 12px 6px 0;font-family:monospace;">${pg.path}</td><td style="padding:6px 0;text-align:right;">${pg.views.toLocaleString()}</td></tr>`
    )
    .join("");

  const dailyRows = report.dailyMetrics
    .map(
      (d) =>
        `<tr><td style="padding:4px 12px 4px 0;">${d.date}</td><td style="padding:4px 8px;text-align:right;">${d.sessions}</td><td style="padding:4px 8px;text-align:right;">${d.activeUsers}</td><td style="padding:4px 0;text-align:right;">${d.newUsers}</td></tr>`
    )
    .join("");

  return `
<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;">
  <h2 style="margin-bottom:4px;">Weekly Analytics Report</h2>
  <p style="color:#666;margin-top:0;">${clientName} &mdash; ${p.label}</p>

  <h3 style="margin-bottom:8px;">Summary</h3>
  <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:6px;">
    <tr>
      <td style="padding:10px 16px;font-weight:bold;">Sessions</td>
      <td style="padding:10px 16px;text-align:right;">${report.sessions.toLocaleString()}</td>
      <td style="padding:10px 16px;font-weight:bold;">Active Users</td>
      <td style="padding:10px 16px;text-align:right;">${report.activeUsers.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:bold;">New Users</td>
      <td style="padding:10px 16px;text-align:right;">${report.newUsers.toLocaleString()}</td>
      <td style="padding:10px 16px;font-weight:bold;">Avg. Duration</td>
      <td style="padding:10px 16px;text-align:right;">${formatDuration(report.avgSessionDurationSecs)}</td>
    </tr>
  </table>

  ${
    report.topSources.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;">Top Traffic Sources</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="border-bottom:1px solid #e0e0e0;">
      <th style="padding:6px 12px 6px 0;text-align:left;">Source</th>
      <th style="padding:6px 0;text-align:right;">Sessions</th>
    </tr></thead>
    <tbody>${topSourcesRows}</tbody>
  </table>`
      : ""
  }

  ${
    report.topPages.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;">Top Pages</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="border-bottom:1px solid #e0e0e0;">
      <th style="padding:6px 12px 6px 0;text-align:left;">Page</th>
      <th style="padding:6px 0;text-align:right;">Views</th>
    </tr></thead>
    <tbody>${topPagesRows}</tbody>
  </table>`
      : ""
  }

  ${
    report.dailyMetrics.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;">Daily Breakdown</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="border-bottom:1px solid #e0e0e0;">
      <th style="padding:4px 12px 4px 0;text-align:left;">Date</th>
      <th style="padding:4px 8px;text-align:right;">Sessions</th>
      <th style="padding:4px 8px;text-align:right;">Active</th>
      <th style="padding:4px 0;text-align:right;">New</th>
    </tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>`
      : ""
  }
</div>`;
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const sendWeeklyAnalyticsReport = inngest.createFunction(
  {
    id: "send-weekly-analytics-report",
    retries: 3,
  },
  { event: "analytics/report.requested" },
  async ({ event, step }) => {
    const data = event.data as AnalyticsReportRequestedPayload;
    const clientId = data?.clientId;

    await step.run("validate-payload", async () => {
      if (!clientId) {
        throw new Error("Missing required field: clientId");
      }
    });

    const client = await step.run("fetch-client-config", async () => {
      const c = await getClientById(clientId);
      if (!c.ga4_property_id) {
        throw new Error(`GA4 property not configured: ${clientId}`);
      }
      return c;
    });

    const resolvedPeriod = await step.run("resolve-report-period", async () => {
      return resolvePeriod(data.reportPeriod, data.scheduledAt);
    });

    log("Workflow started", {
      clientId,
      env: config.env,
      preset: data.reportPeriod.preset,
      resolvedPeriod,
    } as any);

    const report = await step.run("fetch-analytics-data", async () => {
      return getAnalyticsReport(client.ga4_property_id!, resolvedPeriod);
    });

    const result = await step.run("send-email", async () => {
      const subject = `Your analytics report — ${resolvedPeriod.label}`;
      const html = buildReportEmail(client.name, report);
      return sendEmail({ to: client.email, subject, html });
    });

    await step.run("log-result", async () => {
      log("Workflow completed", {
        clientId,
        preset: data.reportPeriod.preset,
        resolvedPeriod,
        mode: result.mode,
        outcome: result.outcome,
        originalTo: result.originalTo,
        isMock: report.isMock,
      } as any);
    });

    return {
      clientId,
      preset: data.reportPeriod.preset,
      resolvedPeriod,
      outcome: result.outcome,
      isMock: report.isMock,
    };
  }
);
