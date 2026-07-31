import type { ClientRow } from "../../../src/types/index";

const mockLogError = vi.hoisted(() => vi.fn());

vi.mock("../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: mockLogError,
  flush: vi.fn(),
}));

import { resolveRecipients } from "../../../src/lib/notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "client-test",
    name: "Test Client",
    email: "owner@test.com",
    ga4_property_id: null,
    active: true,
    settings: {},
    created_at: new Date(),
    google_service_account_email: null,
    google_service_account_key: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tier 3: client.email fallback (no payload, no settings)
// ---------------------------------------------------------------------------
describe("resolveRecipients — tier 3: client.email fallback", () => {
  it("returns client.email with source=client_email when settings has no notifications key", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email when notifications key is present but workflow key is absent", () => {
    const client = makeClient({ settings: { notifications: { analytics_report: ["a@b.com"] } } });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email when the workflow key is an empty array", () => {
    const client = makeClient({ settings: { notifications: { form_submitted: [] } } });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email when notifications value is not an object", () => {
    const client = makeClient({ settings: { notifications: "invalid" } });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email when the workflow key value is not an array", () => {
    const client = makeClient({ settings: { notifications: { form_submitted: "not-an-array" } } });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email with source=client_email when payloadRecipients is undefined", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("returns client.email with source=client_email when payloadRecipients is an empty array", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", []);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });
});

// ---------------------------------------------------------------------------
// Tier 2: settings list
// ---------------------------------------------------------------------------
describe("resolveRecipients — tier 2: settings list", () => {
  it("returns the configured list with source=settings when all addresses are valid", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["sales@example.com", "owner@example.com"] } },
    });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({
      recipients: ["sales@example.com", "owner@example.com"],
      source: "settings",
    });
  });

  it("returns a single-element list for analytics_report key", () => {
    const client = makeClient({
      settings: { notifications: { analytics_report: ["marketing@example.com"] } },
    });
    const result = resolveRecipients(client, "analytics_report", undefined);
    expect(result).toEqual({ recipients: ["marketing@example.com"], source: "settings" });
  });

  it("resolves independently per workflow key on the same client", () => {
    const client = makeClient({
      settings: {
        notifications: {
          form_submitted: ["sales@example.com"],
          analytics_report: ["marketing@example.com"],
        },
      },
    });
    expect(resolveRecipients(client, "form_submitted", undefined)).toEqual({
      recipients: ["sales@example.com"],
      source: "settings",
    });
    expect(resolveRecipients(client, "analytics_report", undefined)).toEqual({
      recipients: ["marketing@example.com"],
      source: "settings",
    });
  });

  it("filters invalid settings addresses and returns remaining valid ones with source=settings", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["valid@example.com", "not-an-email", ""] } },
    });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["valid@example.com"], source: "settings" });
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });

  it("falls back to client.email when all settings addresses are invalid", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["no-at-sign", "", 42] } },
    });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
    expect(mockLogError).toHaveBeenCalledTimes(3);
  });

  it("deduplicates case-insensitively in the settings tier", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["Alice@Example.com", "alice@example.com", "BOB@example.com"] } },
    });
    const result = resolveRecipients(client, "form_submitted", undefined);
    expect(result).toEqual({
      recipients: ["Alice@Example.com", "BOB@example.com"],
      source: "settings",
    });
  });
});

// ---------------------------------------------------------------------------
// Tier 1: payload-level override
// ---------------------------------------------------------------------------
describe("resolveRecipients — tier 1: payload recipients", () => {
  it("uses payload addresses with source=payload, ignoring settings", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["settings@example.com"] } },
    });
    const result = resolveRecipients(client, "form_submitted", ["payload@example.com"]);
    expect(result).toEqual({ recipients: ["payload@example.com"], source: "payload" });
  });

  it("uses payload addresses with source=payload when no settings configured", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", ["alice@example.com", "bob@example.com"]);
    expect(result).toEqual({
      recipients: ["alice@example.com", "bob@example.com"],
      source: "payload",
    });
  });

  it("deduplicates case-insensitively in the payload tier (keeps first occurrence)", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", [
      "Alice@Example.com",
      "alice@example.com",
      "BOB@example.com",
    ]);
    expect(result).toEqual({
      recipients: ["Alice@Example.com", "BOB@example.com"],
      source: "payload",
    });
  });

  it("discards invalid payload addresses and uses remaining valid ones", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", [
      "valid@example.com",
      "not-an-email",
      "",
    ]);
    expect(result).toEqual({ recipients: ["valid@example.com"], source: "payload" });
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });

  it("falls back to settings tier when all payload addresses are invalid", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["settings@example.com"] } },
    });
    const result = resolveRecipients(client, "form_submitted", ["not-an-email"]);
    expect(result).toEqual({ recipients: ["settings@example.com"], source: "settings" });
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("falls back to client.email when all payload addresses are invalid and no settings configured", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", ["not-an-email"]);
    expect(result).toEqual({ recipients: ["owner@test.com"], source: "client_email" });
  });

  it("treats whitespace-only strings as invalid", () => {
    const client = makeClient({ settings: {} });
    const result = resolveRecipients(client, "form_submitted", ["   ", "valid@example.com"]);
    expect(result).toEqual({ recipients: ["valid@example.com"], source: "payload" });
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("logs errors with tier=payload context for discarded payload entries", () => {
    const client = makeClient({ settings: {} });
    resolveRecipients(client, "form_submitted", ["bad-address", "valid@example.com"]);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Error),
      expect.objectContaining({ clientId: "client-test", tier: "payload" })
    );
  });
});
