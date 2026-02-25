import { Resend } from "resend";
import { config } from "./config";
import { log } from "../utils/logger";
import { writeEmailPreview } from "../utils/email-preview";
import type { EmailRequest, EmailResult } from "../types/index";

function getResendClient(): Resend {
  if (!config.resendApiKey) {
    throw new Error(
      "Resend client requires RESEND_API_KEY — check EMAIL_MODE configuration"
    );
  }
  return new Resend(config.resendApiKey);
}

function validateRecipient(to: string): void {
  if (!to || !to.includes("@")) {
    throw new Error(
      `Invalid email recipient: "${to}" — must be non-empty and contain "@"`
    );
  }
}

export async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  validateRecipient(request.to);

  const from = request.from ?? config.resendFrom;
  const mode = config.emailMode;

  if (mode === "mock") {
    log(`[mock] Would send to: ${request.to} | Subject: ${request.subject} | Body length: ${request.html.length} chars`);
    writeEmailPreview({ to: request.to, subject: request.subject, html: request.html });
    return {
      mode,
      originalTo: request.to,
      actualTo: request.to,
      subject: request.subject,
      outcome: "logged",
    };
  }

  const actualTo =
    mode === "test" ? config.testEmail! : request.to;
  const subject =
    mode === "test"
      ? `[TEST: ${request.to}] ${request.subject}`
      : request.subject;

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from,
    to: actualTo,
    subject,
    html: request.html,
  });

  if (error) {
    const retryable = ["rate_limit_exceeded", "application_error", "internal_server_error"];
    const tag = retryable.includes(error.name) ? "(retryable)" : "(not retryable)";
    throw new Error(`Resend error [${error.name}] ${tag}: ${error.message}`);
  }

  if (mode === "test") {
    log(`[test] Redirected to: ${actualTo} (original: ${request.to}) | Subject: ${subject}`);
  } else {
    log(`[live] Sent to: ${request.to} | Resend ID: ${data!.id}`);
  }

  return {
    mode,
    originalTo: request.to,
    actualTo,
    subject,
    outcome: "sent",
    resendId: data!.id,
  };
}
