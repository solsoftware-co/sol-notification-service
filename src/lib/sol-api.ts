import { config } from "./config";
import type { ClientRow, NotificationLogEntry } from "../types/index";

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

export async function getClientById(id: string): Promise<ClientRow> {
  return solApiFetch<ClientRow>(`/v1/clients/${encodeURIComponent(id)}`);
}

export async function getAllActiveClients(options?: {
  limit?: number;
}): Promise<ClientRow[]> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const qs = params.toString();

  // GET /v1/clients returns ClientSummary — google_service_account_key is
  // omitted at the list level; callers that need it fetch the full record
  // via getClientById.
  const rows = await solApiFetch<
    (Omit<ClientRow, "google_service_account_key"> & {
      google_service_account_key?: string | null;
    })[]
  >(`/v1/clients${qs ? `?${qs}` : ""}`);

  return rows.map((row) => ({
    ...row,
    google_service_account_key: row.google_service_account_key ?? null,
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
