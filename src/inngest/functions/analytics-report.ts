import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById } from "../../lib/db";
import { getAnalyticsReport } from "../../lib/analytics";
import { sendEmail } from "../../lib/email";
import { renderAnalyticsReportEmail } from "../../lib/templates";
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
// Inngest function
// ---------------------------------------------------------------------------

export const sendAnalyticsReport = inngest.createFunction(
  {
    id: "send-analytics-report",
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
      const rendered = await renderAnalyticsReportEmail(report, client, resolvedPeriod);
      return sendEmail({
        to: client.email,
        subject: rendered.subject,
        html: rendered.html,
        attachments: rendered.attachments,
      });
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
