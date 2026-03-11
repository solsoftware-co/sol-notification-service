import { MailtrapClient } from "mailtrap";

export interface MailtrapMessage {
  id: number;
  subject: string;
  to_email: string;
  from_email: string;
  html_body: string;
  text_body: string;
  created_at: string;
}

function getClient(): MailtrapClient {
  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) throw new Error("MAILTRAP_API_TOKEN environment variable is required");
  return new MailtrapClient({ token, accountId: getAccountId() });
}

function getAccountId(): number {
  const id = process.env.MAILTRAP_ACCOUNT_ID;
  if (!id) throw new Error("MAILTRAP_ACCOUNT_ID environment variable is required");
  return Number(id);
}

function getInboxId(): number {
  const id = process.env.MAILTRAP_INBOX_ID;
  if (!id) throw new Error("MAILTRAP_INBOX_ID environment variable is required");
  return Number(id);
}

/**
 * Polls the Mailtrap test inbox until an email matching `subjectPattern`
 * arrives with a `created_at` timestamp >= `triggeredAt`.
 *
 * The timestamp window ensures concurrent PR runs don't pick up each other's
 * emails even when sharing a single free-tier inbox.
 */
export async function waitForEmail(
  subjectPattern: RegExp,
  triggeredAt: Date,
  timeoutMs = 90000,
  intervalMs = 3000
): Promise<MailtrapMessage> {
  const client = getClient();
  const accountId = getAccountId();
  const inboxId = getInboxId();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = (await client.testing.messages.get(
      accountId,
      inboxId
    )) as unknown as MailtrapMessage[];

    const match = messages.find(
      (m) =>
        new Date(m.created_at) >= triggeredAt &&
        subjectPattern.test(m.subject)
    );

    if (match) return match;

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Email matching /${subjectPattern.source}/ not received within ${timeoutMs}ms` +
      ` (triggered at ${triggeredAt.toISOString()})`
  );
}
