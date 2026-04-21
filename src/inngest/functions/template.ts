/**
 * TEMPLATE — Copy this file to create a new workflow. Do NOT register this file
 * directly in src/inngest/functions/index.ts. Steps to use:
 *
 *   1. cp src/inngest/functions/template.ts src/inngest/functions/my-workflow.ts
 *   2. Change the event name in `trigger` below
 *   3. Replace the placeholder business logic in each step
 *   4. Add the exported function to src/inngest/functions/index.ts
 *   5. Run `npm run type-check` — zero errors expected
 */

import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById } from "../../lib/db";
import { sendEmail } from "../../lib/email";
import { log, logError, setRunContext } from "../../utils/logger";
import type { BaseEventPayload } from "../../types/index";

export const templateFunction = inngest.createFunction(
  {
    id: "template-workflow",
    retries: 3,
  },
  { event: "template/triggered" },
  async ({ event, step, runId }) => {
    const { clientId } = event.data as BaseEventPayload;

    setRunContext({ runId, clientId });
    log(`template/triggered received for client ${clientId}`);

    const client = await step.run("fetch-client-config", async () => {
      return getClientById(clientId);
    });

    const result = await step.run("send-email", async () => {
      log(`Sending template notification to ${client.email}`);
      return sendEmail({
        to: client.email,
        subject: "Notification from the template",
        html: `<p>Hello ${client.name}, this is a template notification.</p>`,
      });
    });

    await step.run("log-result", async () => {
      log(`Template notification sent to ${result.originalTo} — outcome: ${result.outcome}`);
    });

    return { clientId, outcome: result.outcome };
  }
);
