import { Resend } from "resend";
import nodemailer from "nodemailer";
import { config } from "./config";
import { log } from "../utils/logger";
import { writeEmailPreview } from "../utils/email-preview";
import type { EmailRequest, EmailResult, EmailAttachment } from "../types/index";

function getResendClient(): Resend {
  if (!config.resendApiKey) {
    throw new Error(
      "Resend client requires RESEND_API_KEY — check EMAIL_MODE configuration"
    );
  }
  return new Resend(config.resendApiKey);
}

function validateRecipient(to: string | string[]): void {
  if (Array.isArray(to)) {
    if (to.length === 0) {
      throw new Error(`Invalid email recipient: empty array — must contain at least one address`);
    }
    for (const addr of to) {
      if (!addr || !addr.includes("@")) {
        throw new Error(`Invalid email recipient: "${addr}" — must be non-empty and contain "@"`);
      }
    }
  } else {
    if (!to || !to.includes("@")) {
      throw new Error(
        `Invalid email recipient: "${to}" — must be non-empty and contain "@"`
      );
    }
  }
}

export async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  validateRecipient(request.to);

  const from = request.from ?? config.resendFrom;
  const mode = config.emailMode;

  const toLabel = Array.isArray(request.to) ? request.to.join(", ") : request.to;

  if (mode === "mock") {
    log(`[mock] Would send to: ${toLabel} | Subject: ${request.subject} | Body length: ${request.html.length} chars`);
    writeEmailPreview({ to: toLabel, subject: request.subject, html: request.html, attachments: request.attachments });
    return {
      mode,
      originalTo: request.to,
      actualTo: request.to,
      subject: request.subject,
      outcome: "logged",
    };
  }

  if (mode === "mailtrap") {
    const subject = `[TEST: ${toLabel}] ${request.subject}`;
    const transport = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: config.mailtrapSmtpUser!,
        pass: config.mailtrapSmtpPass!,
      },
    });
    const attachments = request.attachments?.map((a: EmailAttachment) => ({
      filename: a.filename,
      content: a.content,
      ...(a.content_id   ? { cid: a.content_id }             : {}),
      ...(a.content_type ? { contentType: a.content_type }   : {}),
    }));
    await transport.sendMail({
      from: request.from ?? config.resendFrom,
      to: request.to,
      subject,
      html: request.html,
      ...(attachments?.length ? { attachments } : {}),
    });
    log(`[mailtrap] Sent to: ${toLabel} | Subject: ${subject}`);
    return {
      mode,
      originalTo: request.to,
      actualTo: request.to,
      subject,
      outcome: "sent",
    };
  }

  const actualTo =
    mode === "test" ? config.testEmail! : request.to;
  const subject =
    mode === "test"
      ? `[TEST: ${toLabel}] ${request.subject}`
      : request.subject;

  const resend = getResendClient();
  const attachments = request.attachments && request.attachments.length > 0
    ? request.attachments.map((a: EmailAttachment) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
        ...(a.content_id   ? { content_id:   a.content_id }   : {}),
        ...(a.content_type ? { content_type: a.content_type } : {}),
      })) as any
    : undefined;

  const { data, error } = await resend.emails.send({
    from,
    to: actualTo,
    subject,
    html: request.html,
    ...(attachments ? { attachments } : {}),
  });

  if (error) {
    const retryable = ["rate_limit_exceeded", "application_error", "internal_server_error"];
    const tag = retryable.includes(error.name) ? "(retryable)" : "(not retryable)";
    throw new Error(`Resend error [${error.name}] ${tag}: ${error.message}`);
  }

  if (mode === "test") {
    log(`[test] Redirected to: ${actualTo} (original: ${toLabel}) | Subject: ${subject}`);
  } else {
    log(`[live] Sent to: ${toLabel} | Resend ID: ${data!.id}`);
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
