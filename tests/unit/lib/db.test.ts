// T009: db module unit tests
// vi.hoisted must appear before vi.mock — Vitest hoists both, but hoisted vars
// must be declared before the vi.mock calls that reference them.
const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("@neondatabase/serverless", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    on: vi.fn(),
  })),
  neonConfig: {},
}));

vi.mock("../../../src/lib/config", () => ({
  config: { databaseUrl: "postgresql://mock" },
}));

// Imports after mocks
import { getClientById, writeNotificationLog } from "../../../src/lib/db";
import type { ClientRow, NotificationLogEntry } from "../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockClientRow: ClientRow = {
  id: "client-acme",
  name: "Acme Corp",
  email: "owner@acme.com",
  active: true,
  ga4_property_id: null,
  settings: {},
  created_at: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
describe("writeNotificationLog", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("executes an INSERT with all fields including resend_id", async () => {
    await writeNotificationLog(baseLogEntry);

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO notification_logs");
    expect(params).toEqual([
      "client-acme",
      "send-form-notification",
      "form/submitted",
      "sent",
      "owner@acme.com",
      "New inquiry — Acme Corp",
      "resend-abc123",
      null,
      JSON.stringify({ formData: { submitterName: "Jane" } }),
    ]);
  });

  it("sets resend_id to null when not provided (mock/test mode)", async () => {
    const { resend_id: _, ...entryWithoutResendId } = baseLogEntry;
    await writeNotificationLog(entryWithoutResendId);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[6]).toBeNull(); // $7 = resend_id
  });

  it("sets error_message when outcome is failed", async () => {
    await writeNotificationLog({
      ...baseLogEntry,
      outcome: "failed",
      resend_id: undefined,
      error_message: "Resend API returned 422",
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[3]).toBe("failed");   // $4 = outcome
    expect(params[6]).toBeNull();       // $7 = resend_id
    expect(params[7]).toBe("Resend API returned 422"); // $8 = error_message
  });
});

// ---------------------------------------------------------------------------
describe("getClientById", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns active client when found", async () => {
    mockQuery.mockResolvedValue({ rows: [mockClientRow] });

    const result = await getClientById("client-acme");

    expect(result).toEqual(mockClientRow);
  });

  it("throws when client is not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await expect(getClientById("client-acme")).rejects.toThrow(
      /Client not found: client-acme/
    );
  });

  it("throws when client is inactive", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ ...mockClientRow, active: false }],
    });

    await expect(getClientById("client-acme")).rejects.toThrow(
      /Client inactive: client-acme/
    );
  });
});
