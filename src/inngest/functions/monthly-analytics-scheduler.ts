import { inngest } from "../client";
import { config } from "../../lib/config";
import { getAllActiveClients } from "../../lib/db";
import { isNonHolidayWeekday } from "../../utils/business-days";
import { log } from "../../utils/logger";

const MAX_DELAY_DAYS = 7;

export const monthlyAnalyticsScheduler = inngest.createFunction(
  {
    id: "monthly-analytics-scheduler",
    retries: 2,
    concurrency: { limit: 1, scope: "fn" },
  },
  [{ cron: "0 9 2 * *" }, { event: "analytics/monthly.scheduled" }],
  async ({ step }) => {
    log("Monthly analytics scheduler started", { env: config.env } as any);

    // Capture trigger time once — cached on replay so candidate dates stay deterministic
    const triggerDateStr = await step.run("capture-trigger-date", async () => {
      const now = new Date();
      now.setUTCHours(9, 0, 0, 0);
      return now.toISOString();
    });

    // Walk forward day-by-day until a non-holiday weekday is found
    let targetDateStr: string | null = null;

    for (let i = 0; i < MAX_DELAY_DAYS; i++) {
      const candidate = new Date(
        new Date(triggerDateStr).getTime() + i * 24 * 60 * 60 * 1000
      );

      const isGood = await step.run(`check-business-day-${i}`, async () => {
        return isNonHolidayWeekday(candidate);
      });

      if (isGood) {
        targetDateStr = candidate.toISOString();
        break;
      }

      if (i < MAX_DELAY_DAYS - 1) {
        const nextCheck = new Date(
          candidate.getTime() + 24 * 60 * 60 * 1000
        );
        nextCheck.setUTCHours(9, 0, 0, 0);
        await step.sleepUntil(`sleep-until-day-${i + 1}`, nextCheck);
      }
    }

    if (!targetDateStr) {
      log("Monthly analytics scheduler: no business day found within 7 days — skipping");
      return { dispatched: 0, env: config.env, skipped: true };
    }

    const clients = await step.run("fetch-active-clients", async () => {
      return getAllActiveClients({
        testOnly: config.env !== "production",
        limit: config.env !== "production" ? 1 : undefined,
      });
    });

    log(`Fetched ${clients.length} active client(s)`, { env: config.env } as any);

    if (clients.length === 0) {
      log("No active clients to report on — skipping fan-out");
      return { dispatched: 0, env: config.env };
    }

    const events = clients.map((client) => ({
      name: "analytics/report.requested" as const,
      data: {
        clientId: client.id,
        reportPeriod: { preset: "last_month" as const },
        scheduledAt: targetDateStr!,
      },
    }));

    const { ids } = await step.sendEvent("fan-out-report-events", events);

    log(`Dispatched ${ids.length} monthly analytics report event(s)`, {
      env: config.env,
    } as any);

    return { dispatched: ids.length, env: config.env };
  }
);
