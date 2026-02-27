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
import { getClientById } from "../../../src/lib/db";
import type { ClientRow } from "../../../src/types/index";

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
