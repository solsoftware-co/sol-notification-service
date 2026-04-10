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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe("resolveRecipients — fallback cases", () => {
  it("returns [client.email] when settings has no notifications key", () => {
    const client = makeClient({ settings: {} });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
  });

  it("returns [client.email] when notifications is present but the workflow key is absent", () => {
    const client = makeClient({ settings: { notifications: { analytics_report: ["a@b.com"] } } });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
  });

  it("returns [client.email] when the workflow key is an empty array", () => {
    const client = makeClient({ settings: { notifications: { form_submitted: [] } } });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
  });

  it("returns [client.email] when notifications value is not an object", () => {
    const client = makeClient({ settings: { notifications: "invalid" } });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
  });

  it("returns [client.email] when the workflow key value is not an array", () => {
    const client = makeClient({ settings: { notifications: { form_submitted: "not-an-array" } } });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
  });
});

// ---------------------------------------------------------------------------
describe("resolveRecipients — valid addresses", () => {
  it("returns the configured list when all addresses are valid", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["sales@example.com", "owner@example.com"] } },
    });
    expect(resolveRecipients(client, "form_submitted")).toEqual([
      "sales@example.com",
      "owner@example.com",
    ]);
  });

  it("returns a single-element list when one valid address is configured", () => {
    const client = makeClient({
      settings: { notifications: { analytics_report: ["marketing@example.com"] } },
    });
    expect(resolveRecipients(client, "analytics_report")).toEqual(["marketing@example.com"]);
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
    expect(resolveRecipients(client, "form_submitted")).toEqual(["sales@example.com"]);
    expect(resolveRecipients(client, "analytics_report")).toEqual(["marketing@example.com"]);
  });
});

// ---------------------------------------------------------------------------
describe("resolveRecipients — invalid address handling", () => {
  it("filters out invalid addresses and returns remaining valid ones", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["valid@example.com", "not-an-email", ""] } },
    });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["valid@example.com"]);
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });

  it("falls back to [client.email] when all addresses are invalid and logs a warning per entry", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["no-at-sign", "", 42] } },
    });
    expect(resolveRecipients(client, "form_submitted")).toEqual(["owner@test.com"]);
    expect(mockLogError).toHaveBeenCalledTimes(3);
  });

  it("includes clientId and workflowKey in the logError call", () => {
    const client = makeClient({
      settings: { notifications: { form_submitted: ["bad-address"] } },
    });
    resolveRecipients(client, "form_submitted");
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Error),
      expect.objectContaining({ clientId: "client-test", workflowKey: "form_submitted" })
    );
  });
});
