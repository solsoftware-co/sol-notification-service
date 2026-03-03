import { inngest } from "../client";
import { config } from "../../lib/config";
import { getAllActiveClients } from "../../lib/db";
import { log } from "../../utils/logger";

export const weeklyAnalyticsScheduler = inngest.createFunction(
  {
    id: "weekly-analytics-scheduler",
    retries: 2,
    concurrency: { limit: 1, scope: "fn" },
  },
  [{ cron: "0 9 * * 2" }, { event: "analytics/weekly.scheduled" }],
  async ({ step }) => {
    log("Weekly analytics scheduler started", { env: config.env } as any);

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

    const scheduledAt = new Date().toISOString();

    const events = clients.map((client) => ({
      name: "analytics/report.requested" as const,
      data: {
        clientId: client.id,
        reportPeriod: { preset: "last_week" as const },
        scheduledAt,
      },
    }));

    const { ids } = await step.sendEvent("fan-out-report-events", events);

    log(`Dispatched ${ids.length} analytics report event(s)`, {
      env: config.env,
    } as any);

    return { dispatched: ids.length, env: config.env };
  }
);
