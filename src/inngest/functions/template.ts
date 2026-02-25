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
import { log, logError } from "../../utils/logger";
import type { BaseEventPayload } from "../../types/index";

export const templateFunction = inngest.createFunction(
  {
    id: "template-workflow",
    retries: 3,
  },
  { event: "template/triggered" },
  async ({ event, step }) => {
    const { clientId } = event.data as BaseEventPayload;

    await step.run("log-start", async () => {
      log("Workflow started", { clientId, eventName: event.name, env: config.env });
    });

    const client = await step.run("fetch-client-config", async () => {
      return getClientById(clientId);
    });

    const result = await step.run("send-email", async () => {
      return sendEmail({
        to: client.email,
        subject: "Notification from the template",
        html: `<p>Hello ${client.name}, this is a template notification.</p>`,
      });
    });

    await step.run("log-result", async () => {
      log("Workflow completed", {
        clientId,
        mode: result.mode,
        outcome: result.outcome,
        originalTo: result.originalTo,
      });
    });

    return { clientId, outcome: result.outcome };
  }
);
