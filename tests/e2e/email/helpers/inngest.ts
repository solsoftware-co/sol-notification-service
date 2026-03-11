export interface InngestRun {
  run_id: string;
  status: "Completed" | "Failed" | "Cancelled" | "Running" | "Queued";
  output?: unknown;
}

const TERMINAL_STATUSES = new Set(["Completed", "Failed", "Cancelled"]);

/**
 * Sends an Inngest event to the staging environment via the REST API.
 * Returns the event ID for use with waitForRunCompletion().
 */
export async function triggerFlow(
  eventName: string,
  data: Record<string, unknown>
): Promise<string> {
  const eventKey = process.env.INNGEST_EVENT_KEY_STAGING;
  if (!eventKey) {
    throw new Error("INNGEST_EVENT_KEY_STAGING environment variable is required");
  }

  const res = await fetch(`https://inn.gs/e/${eventKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: eventName, data }),
  });

  if (!res.ok) {
    throw new Error(`Inngest event send failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { ids: string[]; status: number };
  const eventId = json.ids?.[0];
  if (!eventId) throw new Error("Inngest response missing event ID");

  return eventId;
}

/**
 * Polls the Inngest REST API until the run triggered by `eventId` reaches
 * a terminal state (Completed, Failed, or Cancelled).
 *
 * Throws if the run fails, is cancelled, or does not complete within timeoutMs.
 */
export async function waitForRunCompletion(
  eventId: string,
  timeoutMs = 90000,
  intervalMs = 3000
): Promise<InngestRun> {
  const signingKey = process.env.INNGEST_SIGNING_KEY_STAGING;
  if (!signingKey) {
    throw new Error("INNGEST_SIGNING_KEY_STAGING environment variable is required");
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`https://api.inngest.com/v1/events/${eventId}/runs`, {
      headers: { Authorization: `Bearer ${signingKey}` },
    });

    if (!res.ok) {
      throw new Error(`Inngest runs API failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { data: InngestRun[] };
    const runs = json.data ?? [];

    if (runs.length > 0 && TERMINAL_STATUSES.has(runs[0].status)) {
      const run = runs[0];
      if (run.status === "Failed" || run.status === "Cancelled") {
        throw new Error(
          `Inngest run ${run.run_id} ended with status: ${run.status}`
        );
      }
      return run;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Inngest run for event ${eventId} did not complete within ${timeoutMs}ms`
  );
}
