// sol-api.ts unit tests — a fetch-based HTTP client for sol-api, replacing
// the old direct Postgres connection. Mock global fetch instead of a Pool.

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("../../../src/lib/config", () => ({
  config: {
    solApiUrl: "https://sol-api-staging.solsoftware.workers.dev",
    solApiKey: "test-key",
  },
}));

vi.stubGlobal("fetch", mockFetch);

// Imports after mocks
import {
  getClientById,
  getClientSlackCredentials,
  getAllActiveClients,
  writeNotificationLog,
} from "../../../src/lib/sol-api";
import type { ClientRecord, NotificationLogEntry } from "../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function envelope<T>(data: T) {
  return { success: true as const, data };
}

function errorEnvelope(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function jsonResponse(body: unknown) {
  return { json: async () => body };
}

const mockClientRecord: ClientRecord = {
  id: "client-acme",
  name: "Acme Corp",
  email: "owner@acme.com",
  active: true,
  ga4_property_id: null,
  settings: {},
  created_at: "2024-01-01T00:00:00.000Z",
  google_service_account_email: null,
  google_service_account_key: null,
  slack_webhook_url: null,
  timezone: "America/Chicago",
};

const baseLogEntry: NotificationLogEntry = {
  client_id: "client-acme",
  workflow: "send-form-notification",
  event_name: "form/submitted",
  outcome: "sent",
  recipient_email: "owner@acme.com",
  subject: "New inquiry — Acme Corp",
  resend_id: "resend-abc123",
  metadata: { formData: { submitterName: "Jane" } },
};

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
describe("getClientById", () => {
  it("returns the client on a successful response", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope(mockClientRecord)));

    const result = await getClientById("client-acme");

    expect(result).toEqual(mockClientRecord);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://sol-api-staging.solsoftware.workers.dev/v1/clients/client-acme"
    );
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(
      "test-key"
    );
  });

  it("throws sol-api's message when the client is not found", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(errorEnvelope("NOT_FOUND", "Client not found: client-acme"))
    );

    await expect(getClientById("client-acme")).rejects.toThrow(
      /Client not found: client-acme/
    );
  });
});

// ---------------------------------------------------------------------------
describe("getClientSlackCredentials", () => {
  it("fetches with ?include=slack_credentials and returns the webhook url", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(envelope({ slack_webhook_url: "https://hooks.slack.com/services/xyz" }))
    );

    const result = await getClientSlackCredentials("client-acme");

    expect(result).toEqual({ slack_webhook_url: "https://hooks.slack.com/services/xyz" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://sol-api-staging.solsoftware.workers.dev/v1/clients/client-acme?include=slack_credentials"
    );
  });
});

// ---------------------------------------------------------------------------
describe("getAllActiveClients", () => {
  it("appends limit as a query param when provided", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope([mockClientRecord])));

    await getAllActiveClients({ limit: 1 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://sol-api-staging.solsoftware.workers.dev/v1/clients?limit=1"
    );
  });

  it("omits the query string when no limit is provided", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope([mockClientRecord])));

    await getAllActiveClients();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://sol-api-staging.solsoftware.workers.dev/v1/clients"
    );
  });

  it("defaults missing google_service_account_key and slack_webhook_url to null (list responses omit them)", async () => {
    const { google_service_account_key: _omit1, slack_webhook_url: _omit2, ...summary } = mockClientRecord;
    mockFetch.mockResolvedValue(jsonResponse(envelope([summary])));

    const [result] = await getAllActiveClients();

    expect(result.google_service_account_key).toBeNull();
    expect(result.slack_webhook_url).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("writeNotificationLog", () => {
  it("POSTs the log entry with resend_id included", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope({ id: 1 })));

    await writeNotificationLog(baseLogEntry);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://sol-api-staging.solsoftware.workers.dev/v1/notification-logs"
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: "client-acme",
      workflow: "send-form-notification",
      event_name: "form/submitted",
      outcome: "sent",
      recipient_email: "owner@acme.com",
      subject: "New inquiry — Acme Corp",
      resend_id: "resend-abc123",
      error_message: null,
      metadata: { formData: { submitterName: "Jane" } },
    });
  });

  it("sets resend_id to null when not provided (mock/test mode)", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope({ id: 1 })));
    const { resend_id: _, ...entryWithoutResendId } = baseLogEntry;

    await writeNotificationLog(entryWithoutResendId);

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body as string).resend_id).toBeNull();
  });

  it("sets error_message when outcome is failed", async () => {
    mockFetch.mockResolvedValue(jsonResponse(envelope({ id: 1 })));

    await writeNotificationLog({
      ...baseLogEntry,
      outcome: "failed",
      resend_id: undefined,
      error_message: "Resend API returned 422",
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.outcome).toBe("failed");
    expect(body.resend_id).toBeNull();
    expect(body.error_message).toBe("Resend API returned 422");
  });
});
