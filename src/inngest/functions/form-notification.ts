import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById } from "../../lib/db";
import { sendEmail } from "../../lib/email";
import { renderFormNotificationEmail } from "../../lib/templates";
import { log, logError } from "../../utils/logger";
import type { FormSubmittedPayload } from "../../types/index";

const REQUIRED_FIELDS: (keyof FormSubmittedPayload)[] = [
  "clientId",
  "submitterName",
  "submitterEmail",
  "submitterMessage",
];

export const sendFormNotification = inngest.createFunction(
  {
    id: "send-form-notification",
    retries: 3,
  },
  { event: "form/submitted" },
  async ({ event, step }) => {
    const data = event.data as FormSubmittedPayload;
    const clientId = data.clientId;

    log("Workflow started", { clientId, eventName: event.name, env: config.env });

    await step.run("validate-payload", async () => {
      for (const field of REQUIRED_FIELDS) {
        if (!data[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    });

    const client = await step.run("fetch-client-config", async () => {
      return getClientById(clientId);
    });

    const result = await step.run("send-email", async () => {
      const rendered = await renderFormNotificationEmail(data, client);
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
        mode: result.mode,
        outcome: result.outcome,
        originalTo: result.originalTo,
      });
    });

    return { clientId, outcome: result.outcome };
  }
);
