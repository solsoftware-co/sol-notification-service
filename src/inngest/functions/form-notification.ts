import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById } from "../../lib/db";
import { sendEmail } from "../../lib/email";
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
      const formLabel = data.formId ?? "Unknown form";
      const receivedAt = new Date().toISOString();

      const html = `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>New form submission: ${formLabel}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 140px;">From</td>
              <td style="padding: 8px;">${data.submitterName}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 8px; font-weight: bold;">Email</td>
              <td style="padding: 8px;">${data.submitterEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Form</td>
              <td style="padding: 8px;">${formLabel}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 8px; font-weight: bold;">Received</td>
              <td style="padding: 8px;">${receivedAt}</td>
            </tr>
          </table>
          <h3 style="margin-top: 24px;">Message</h3>
          <p style="white-space: pre-wrap; background: #f9f9f9; padding: 16px; border-radius: 4px;">${data.submitterMessage}</p>
        </div>
      `;

      return sendEmail({
        to: client.email,
        subject: `New form submission: ${formLabel}`,
        html,
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
