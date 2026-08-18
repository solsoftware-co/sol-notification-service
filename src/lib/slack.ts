import { log } from "../utils/logger";
import type { SlackMessageRequest } from "../types/index";

const FETCH_TIMEOUT_MS = 10_000;

// Throws on failure — unlike sheets.ts's appendSheetRow, Slack delivery is
// this workflow's primary action (not a secondary side-channel next to an
// email send), so a transient failure should surface and let Inngest's
// retries apply, the same way sendEmail() throws on a Resend error.
export async function postSlackMessage(
  webhookUrl: string,
  message: SlackMessageRequest
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook ${response.status}: ${body}`);
  }

  log(`Slack message posted successfully`);
}
