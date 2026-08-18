import { config } from "./config";
import type { ClientRecord, ClientSummary, ClientGoogleCredentials, ClientSlackCredentials, NotificationLogEntry } from "../types/index";

const FETCH_TIMEOUT_MS = 10_000;

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

async function solApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.solApiUrl}${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.solApiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!body.success) {
    throw new Error(body.error.message);
  }

  return body.data;
}

export async function getClientById(id: string): Promise<ClientSummary> {
  return solApiFetch<ClientSummary>(`/v1/clients/${encodeURIComponent(id)}`);
}

// GET /v1/clients/:id excludes google_service_account_key by default;
// ?include=google_credentials is the only way to get it back. Call this only
// from inside the step that actually uses the key, never from a
// general-purpose "fetch client config" step, so the credential never ends
// up in a step's persisted output.
export async function getClientGoogleCredentials(
  id: string
): Promise<ClientGoogleCredentials> {
  return solApiFetch<ClientGoogleCredentials>(
    `/v1/clients/${encodeURIComponent(id)}?include=google_credentials`
  );
}

// Same pattern as getClientGoogleCredentials — GET /v1/clients/:id excludes
// slack_webhook_url by default; ?include=slack_credentials opts back in.
// Call this only from inside the step that actually posts to Slack.
export async function getClientSlackCredentials(
  id: string
): Promise<ClientSlackCredentials> {
  return solApiFetch<ClientSlackCredentials>(
    `/v1/clients/${encodeURIComponent(id)}?include=slack_credentials`
  );
}

export async function getAllActiveClients(options?: {
  limit?: number;
}): Promise<ClientRecord[]> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const qs = params.toString();

  // GET /v1/clients returns ClientSummary — google_service_account_key and
  // slack_webhook_url are omitted at the list level; callers that need them
  // fetch the full record via getClientGoogleCredentials/getClientSlackCredentials.
  const rows = await solApiFetch<
    (Omit<ClientRecord, "google_service_account_key" | "slack_webhook_url"> & {
      google_service_account_key?: string | null;
      slack_webhook_url?: string | null;
    })[]
  >(`/v1/clients${qs ? `?${qs}` : ""}`);

  return rows.map((row) => ({
    ...row,
    google_service_account_key: row.google_service_account_key ?? null,
    slack_webhook_url: row.slack_webhook_url ?? null,
  }));
}

export async function writeNotificationLog(
  entry: NotificationLogEntry
): Promise<void> {
  await solApiFetch<unknown>("/v1/notification-logs", {
    method: "POST",
    body: JSON.stringify({
      client_id: entry.client_id,
      workflow: entry.workflow,
      event_name: entry.event_name,
      outcome: entry.outcome,
      recipient_email: entry.recipient_email,
      subject: entry.subject,
      resend_id: entry.resend_id ?? null,
      error_message: entry.error_message ?? null,
      metadata: entry.metadata,
    }),
  });
}

export async function checkSolApiConnection(): Promise<void> {
  try {
    await solApiFetch<{ status: string }>("/health");
    console.log("[sol-api] Connection ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sol-api] Startup connection check failed:", message);
    process.exit(1);
  }
}
