import { inngest } from "../client";
import { getClientById, getClientGoogleCredentials, writeNotificationLog } from "../../lib/sol-api";
import { getAnalyticsReport } from "../../lib/analytics";
import { sendEmail } from "../../lib/email";
import { resolveRecipients } from "../../lib/notifications";
import { renderAnalyticsReportEmail, buildReportTitle } from "../../lib/templates";
import { log, logError, setRunContext } from "../../utils/logger";
import { next9amInTimezone, isNonHolidayWeekdayInTz } from "../../utils/timezone";
import type {
  AnalyticsReportRequestedPayload,
  ResolvedPeriod,
  ReportPeriod,
  AnalyticsReport,
  ClientBannerConfig,
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
    onFailure: async ({ event, error, step }) => {
      const originalData = event.data.event.data as AnalyticsReportRequestedPayload;
      const clientId = originalData.clientId;
      setRunContext({ runId: event.data.run_id, clientId });
      logError(`Analytics report permanently failed for client ${clientId}`, error);

      await step.run("log-terminal-failure", async () => {
        await writeNotificationLog({
          client_id: clientId,
          workflow: "send-analytics-report",
          event_name: "analytics/report.requested",
          outcome: "failed",
          subject: buildReportTitle(originalData.reportPeriod.preset),
          error_message: error.message,
          metadata: { period_preset: originalData.reportPeriod.preset },
        });
      });
    },
  },
  { event: "analytics/report.requested" },
  async ({ event, step, runId }) => {
    const data = event.data as AnalyticsReportRequestedPayload;
    const clientId = data?.clientId;

    setRunContext({ runId, clientId });

    await step.run("validate-payload", async () => {
      if (!clientId) {
        throw new Error("Missing required field: clientId");
      }
    });

    const client = await step.run("fetch-client-config", async () => {
      return getClientById(clientId);
    });

    if (data.enforceDeliveryWindow) {
      const sendTime = await step.run("resolve-send-time", async () => {
        setRunContext({ runId, clientId });
        const tz = client.timezone ?? "America/Chicago";
        const from = new Date(data.scheduledAt);
        log(`Resolving delivery window for client ${clientId} — timezone: ${tz}`);

        let candidate = next9amInTimezone(tz, from);
        for (let i = 0; i < 7; i++) {
          if (isNonHolidayWeekdayInTz(candidate, tz)) {
            return candidate.toISOString();
          }
          candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
        }

        log(`No valid business day found in 7 days for client ${clientId} — sending immediately`);
        return data.scheduledAt;
      });

      await step.sleepUntil("wait-for-send-window", sendTime);
    }

    const resolvedPeriod = await step.run("resolve-report-period", async () => {
      return resolvePeriod(data.reportPeriod, data.scheduledAt);
    });

    const fetchResult = await step.run("fetch-analytics-data", async () => {
      setRunContext({ runId, clientId });
      const { google_service_account_key } = await getClientGoogleCredentials(clientId);

      const report = await getAnalyticsReport(
        resolvedPeriod,
        client.ga4_property_id,
        google_service_account_key,
        {
          topSourcesLimit: data.topSourcesLimit,
          topPagesLimit: data.topPagesLimit,
        }
      );

      // getAnalyticsReport() is the single source of truth for "is this client
      // configured" — it returns undefined rather than proceeding. The reason
      // text below is just descriptive detail for the audit log, not a second
      // gate: by the time we're here, the decision not to proceed already happened.
      if (!report) {
        const reason = !client.ga4_property_id
          ? "Client has no GA4 property configured"
          : "Client has no Google credentials configured";
        await writeNotificationLog({
          client_id: clientId,
          workflow: "send-analytics-report",
          event_name: "analytics/report.requested",
          outcome: "skipped",
          recipient_email: client.email,
          subject: buildReportTitle(data.reportPeriod.preset),
          error_message: reason,
          metadata: {},
        });
        return { skipped: true as const };
      }

      log(`Analytics report started for client ${clientId} — period: ${resolvedPeriod.preset} (${resolvedPeriod.label})`);
      return { skipped: false as const, report };
    });

    if (fetchResult.skipped) {
      return { clientId, outcome: "skipped" };
    }
    const report = fetchResult.report;

    const result = await step.run("send-email", async () => {
      setRunContext({ runId, clientId });
      const { recipients } = resolveRecipients(client, "analytics_report", data.recipients);
      const rendered = await renderAnalyticsReportEmail(report, client, resolvedPeriod);
      const toLabel = Array.isArray(recipients) ? recipients.join(", ") : recipients;
      log(`Sending analytics report email to ${toLabel}`);
      const emailResult = await sendEmail({
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
        attachments: rendered.attachments,
      });
      return { ...emailResult, banner: rendered.banner };
    });

    await step.run("log-result", async () => {
      setRunContext({ runId, clientId });
      const emailResult = result as typeof result & { banner?: ClientBannerConfig };
      const sentTo = Array.isArray(emailResult.originalTo) ? emailResult.originalTo.join(", ") : emailResult.originalTo;
      log(`Analytics report sent to ${sentTo} — outcome: ${emailResult.outcome}`);
      const recipientEmail = Array.isArray(emailResult.originalTo)
        ? emailResult.originalTo.join(", ")
        : emailResult.originalTo;
      await writeNotificationLog({
        client_id: clientId,
        workflow: "send-analytics-report",
        event_name: "analytics/report.requested",
        outcome: emailResult.outcome === "sent" ? "sent" : "failed",
        recipient_email: recipientEmail,
        subject: emailResult.subject,
        resend_id: emailResult.resendId,
        metadata: {
          ga4_property_id: client.ga4_property_id,
          period_preset: data.reportPeriod.preset,
          date_range_start: resolvedPeriod.start,
          date_range_end: resolvedPeriod.end,
          ...(emailResult.banner ? { banner: emailResult.banner } : {}),
        },
      });
    });

    return {
      clientId,
      preset: data.reportPeriod.preset,
      resolvedPeriod,
      outcome: result.outcome,
    };
  }
);
