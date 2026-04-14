import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById, writeNotificationLog } from "../../lib/db";
import { sendEmail } from "../../lib/email";
import { appendSheetRow } from "../../lib/sheets";
import { resolveRecipients } from "../../lib/notifications";
import { renderFormNotificationEmail } from "../../lib/templates";
import { log } from "../../utils/logger";
import type { FormSubmittedPayload } from "../../types/index";

const REQUIRED_FIELDS: (keyof FormSubmittedPayload)[] = [
  "clientId",
];

function buildFieldMap(data: FormSubmittedPayload): Record<string, string> {
  const fields: Record<string, string> = {};
  const scalar: (keyof FormSubmittedPayload)[] = [
    "submitterName",
    "submitterEmail",
    "submitterMessage",
    "submitterPhone",
    "submittedFrom",
    "formName",
  ];
  for (const key of scalar) {
    const val = data[key];
    if (typeof val === "string" && val) {
      fields[key] = val;
    }
  }
  if (data.customFields) {
    Object.assign(fields, data.customFields);
  }
  return fields;
}

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
      const recipients = resolveRecipients(client, "form_submitted");
      const rendered = await renderFormNotificationEmail(data, client);
      return sendEmail({
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
        attachments: rendered.attachments,
      });
    });

    const sheetsOutcome = await step.run("sync-to-google-sheets", async () => {
      if (!data.sheetsDestination) {
        return { skipped: true, reason: "no destination in payload" };
      }
      if (!client.google_service_account_key) {
        return { skipped: true, reason: "no credentials on client" };
      }
      if (config.emailMode !== "live") {
        return { skipped: true, reason: "non-live mode" };
      }
      const fields = buildFieldMap(data);
      const timestamp = new Date().toISOString();
      return appendSheetRow(
        client.google_service_account_key,
        data.sheetsDestination,
        fields,
        timestamp
      );
    });

    await step.run("log-result", async () => {
      log("Workflow completed", {
        clientId,
        mode: result.mode,
        outcome: result.outcome,
        originalTo: result.originalTo,
      });
      if (config.emailMode === "live") {
        const recipientEmail = Array.isArray(result.originalTo)
          ? result.originalTo.join(", ")
          : result.originalTo;
        await writeNotificationLog({
          client_id: clientId,
          workflow: "send-form-notification",
          event_name: "form/submitted",
          outcome: result.outcome === "sent" ? "sent" : "failed",
          recipient_email: recipientEmail,
          subject: result.subject,
          resend_id: result.resendId,
          metadata: { formData: data, sheets_outcome: sheetsOutcome },
        });
      }
    });

    return { clientId, outcome: result.outcome };
  }
);
