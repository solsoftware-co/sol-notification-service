import { inngest } from "../client";
import { config } from "../../lib/config";
import { getAllActiveClients } from "../../lib/sol-api";
import { log, setRunContext } from "../../utils/logger";

export const monthlyAnalyticsScheduler = inngest.createFunction(
  {
    id: "monthly-analytics-scheduler",
    retries: 2,
    concurrency: { limit: 1, scope: "fn" },
  },
  [{ cron: "0 0 2 * *" }, { event: "analytics/monthly.scheduled" }],
  async ({ step, runId }) => {
    setRunContext({ runId });
    log(`Monthly analytics scheduler triggered — env: ${config.env}`);

    const clients = await step.run("fetch-active-clients", async () => {
      return getAllActiveClients({
        limit: config.env !== "production" ? 1 : undefined,
      });
    });

    if (clients.length === 0) {
      log("No active clients found — skipping monthly fan-out");
      return { dispatched: 0, env: config.env };
    }

    log(`Fetched ${clients.length} active client(s) — dispatching monthly reports`);

    const scheduledAt = new Date().toISOString();

    const events = clients.map((client) => ({
      name: "analytics/report.requested" as const,
      data: {
        clientId: client.id,
        reportPeriod: { preset: "last_month" as const },
        scheduledAt,
        enforceDeliveryWindow: true,
      },
    }));

    const { ids } = await step.sendEvent("fan-out-report-events", events);

    log(`Dispatched ${ids.length} monthly analytics report event(s)`);

    return { dispatched: ids.length, env: config.env };
  }
);
