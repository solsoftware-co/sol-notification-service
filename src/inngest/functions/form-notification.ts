import { inngest } from "../client";
import { config } from "../../lib/config";
import { getClientById, getClientGoogleCredentials, writeNotificationLog } from "../../lib/sol-api";
import { sendEmail } from "../../lib/email";
import { appendSheetRow } from "../../lib/sheets";
import { resolveRecipients } from "../../lib/notifications";
import { renderFormNotificationEmail } from "../../lib/templates";
import { log, setRunContext } from "../../utils/logger";
import type { FormSubmittedPayload, EmailResult, ClientBannerConfig } from "../../types/index";

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
  async ({ event, step, runId }) => {
    const data = event.data as FormSubmittedPayload;
    const clientId = data.clientId;

    setRunContext({ runId, clientId });
    log(`form/submitted received for client ${clientId}`);

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

    const { recipients, source: recipientSource } = await step.run("resolve-recipients", async () => {
      return resolveRecipients(client, "form_submitted", data.recipients);
    });

    const result = await step.run("send-email", async () => {
      setRunContext({ runId, clientId });
      if (data.sendEmail === false) {
        return { skipped: true, reason: "sendEmail=false" } as const;
      }
      const rendered = await renderFormNotificationEmail(data, client);
      const toLabel = Array.isArray(recipients) ? recipients.join(", ") : recipients;
      log(`Sending form notification email to ${toLabel}`);
      const emailResult = await sendEmail({
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
        attachments: rendered.attachments,
      });
      return { ...emailResult, banner: rendered.banner };
    });

    const sheetsOutcome = await step.run("sync-to-google-sheets", async () => {
      setRunContext({ runId, clientId });
      if (!data.sheetsDestination) {
        return { skipped: true, reason: "no destination in payload" };
      }
      if (config.emailMode !== "live") {
        return { skipped: true, reason: "non-live mode" };
      }
      const { google_service_account_key } = await getClientGoogleCredentials(clientId);
      if (!google_service_account_key) {
        return { skipped: true, reason: "no credentials on client" };
      }
      const fields = buildFieldMap(data);
      const timestamp = new Date().toISOString();
      return appendSheetRow(
        google_service_account_key,
        data.sheetsDestination,
        fields,
        timestamp
      );
    });

    await step.run("log-result", async () => {
      setRunContext({ runId, clientId });
      if ("skipped" in result && result.skipped) {
        log(`Form notification skipped for client ${clientId} — ${result.reason}`);
        return;
      }
      const emailResult = result as EmailResult & { banner?: ClientBannerConfig };
      const sentTo = Array.isArray(emailResult.originalTo) ? emailResult.originalTo.join(", ") : emailResult.originalTo;
      log(`Form notification sent to ${sentTo} — outcome: ${emailResult.outcome}`);
      if (config.emailMode === "live") {
        const recipientEmail = Array.isArray(emailResult.originalTo)
          ? emailResult.originalTo.join(", ")
          : emailResult.originalTo;
        await writeNotificationLog({
          client_id: clientId,
          workflow: "send-form-notification",
          event_name: "form/submitted",
          outcome: emailResult.outcome === "sent" ? "sent" : "failed",
          recipient_email: recipientEmail,
          subject: emailResult.subject,
          resend_id: emailResult.resendId,
          metadata: { formData: data, sheets_outcome: sheetsOutcome, recipient_source: recipientSource, ...(emailResult.banner ? { banner: emailResult.banner } : {}) },
        });
      }
    });

    const skipped = "skipped" in result && result.skipped;
    return { clientId, outcome: skipped ? "skipped" : (result as EmailResult).outcome };
  }
);
