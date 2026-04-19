// sheets.test.ts — Unit tests for appendSheetRow() and resolveRow()
// Mocks google-auth-library JWT and global fetch; no real API calls are made.

const mockGetAccessToken = vi.hoisted(() => vi.fn());

vi.mock("google-auth-library", () => ({
  JWT: vi.fn().mockImplementation(() => ({
    getAccessToken: mockGetAccessToken,
  })),
}));

vi.mock("../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    databaseUrl: "postgresql://mock",
    logtailToken: null,
  },
}));

vi.mock("../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));

import { appendSheetRow, buildRange, resolveRow } from "../../../src/lib/sheets";
import { JWT } from "google-auth-library";
import type { GoogleSheetsDestination } from "../../../src/types/index";

const VALID_CREDENTIALS = JSON.stringify({
  client_email: "test-sa@project.iam.gserviceaccount.com",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----",
});

const BASE_DESTINATION: GoogleSheetsDestination = {
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
};

const BASE_FIELDS = {
  submitterName: "Jane",
  submitterEmail: "jane@example.com",
};

const TIMESTAMP = "2026-04-13T09:00:00.000Z";

// ---------------------------------------------------------------------------
// buildRange — range string construction
// ---------------------------------------------------------------------------

describe("buildRange", () => {
  it("returns 'A1' when neither sheetName nor tableAnchor is provided", () => {
    expect(buildRange(BASE_DESTINATION)).toBe("A1");
  });

  it("prefixes sheetName when provided and tableAnchor is absent", () => {
    const dest: GoogleSheetsDestination = { ...BASE_DESTINATION, sheetName: "Sheet1" };
    expect(buildRange(dest)).toBe("Sheet1!A1");
  });

  it("uses tableAnchor when provided and sheetName is absent", () => {
    const dest: GoogleSheetsDestination = { ...BASE_DESTINATION, tableAnchor: "B2" };
    expect(buildRange(dest)).toBe("B2");
  });

  it("combines sheetName and tableAnchor when both are provided", () => {
    const dest: GoogleSheetsDestination = { ...BASE_DESTINATION, sheetName: "Inquiry Log", tableAnchor: "B2" };
    expect(buildRange(dest)).toBe("Inquiry Log!B2");
  });
});

// ---------------------------------------------------------------------------
// resolveRow — column mapping logic
// ---------------------------------------------------------------------------

describe("resolveRow", () => {
  it("defaults to [timestamp, ...field values in received order] when columns is absent", () => {
    const row = resolveRow(BASE_DESTINATION, BASE_FIELDS, TIMESTAMP);
    expect(row).toEqual([TIMESTAMP, "Jane", "jane@example.com"]);
  });

  it("applies explicit column mapping in declared order", () => {
    const dest: GoogleSheetsDestination = {
      ...BASE_DESTINATION,
      columns: ["_timestamp", "submitterEmail", "submitterName"],
    };
    const row = resolveRow(dest, BASE_FIELDS, TIMESTAMP);
    expect(row).toEqual([TIMESTAMP, "jane@example.com", "Jane"]);
  });

  it("maps _timestamp to the provided timestamp string", () => {
    const dest: GoogleSheetsDestination = {
      ...BASE_DESTINATION,
      columns: ["_timestamp"],
    };
    const row = resolveRow(dest, BASE_FIELDS, TIMESTAMP);
    expect(row).toEqual([TIMESTAMP]);
  });

  it("writes empty string for a field referenced in columns but absent from submission", () => {
    const dest: GoogleSheetsDestination = {
      ...BASE_DESTINATION,
      columns: ["submitterName", "missingField"],
    };
    const row = resolveRow(dest, BASE_FIELDS, TIMESTAMP);
    expect(row).toEqual(["Jane", ""]);
  });

  it("returns an empty array when columns is an empty array", () => {
    const dest: GoogleSheetsDestination = {
      ...BASE_DESTINATION,
      columns: [],
    };
    const row = resolveRow(dest, BASE_FIELDS, TIMESTAMP);
    expect(row).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// appendSheetRow — API integration (fetch mocked)
// ---------------------------------------------------------------------------

describe("appendSheetRow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply JWT constructor mock after resetAllMocks() clears implementations
    vi.mocked(JWT).mockImplementation(() => ({
      getAccessToken: mockGetAccessToken,
    }) as unknown as JWT);
    mockGetAccessToken.mockResolvedValue({ token: "mock-access-token" });
  });

  it("returns { success: true, rowsAppended: 1 } on a successful append", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updates: { updatedRows: 1 } }),
    } as Response);

    const result = await appendSheetRow(
      VALID_CREDENTIALS,
      BASE_DESTINATION,
      BASE_FIELDS,
      TIMESTAMP
    );

    expect(result).toEqual({ success: true, rowsAppended: 1 });
  });

  it("returns { success: false } when Sheets API responds with 403", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "The caller does not have permission",
    } as Response);

    const result = await appendSheetRow(
      VALID_CREDENTIALS,
      BASE_DESTINATION,
      BASE_FIELDS,
      TIMESTAMP
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Sheets API 403/);
  });

  it("returns { success: false } when Sheets API responds with 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Spreadsheet not found",
    } as Response);

    const result = await appendSheetRow(
      VALID_CREDENTIALS,
      BASE_DESTINATION,
      BASE_FIELDS,
      TIMESTAMP
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Sheets API 404/);
  });

  it("returns { success: false } when credentialsJson is malformed JSON", async () => {
    const result = await appendSheetRow(
      "NOT_VALID_JSON",
      BASE_DESTINATION,
      BASE_FIELDS,
      TIMESTAMP
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns { success: false } when getAccessToken returns null token", async () => {
    mockGetAccessToken.mockResolvedValue({ token: null });

    const result = await appendSheetRow(
      VALID_CREDENTIALS,
      BASE_DESTINATION,
      BASE_FIELDS,
      TIMESTAMP
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to obtain access token/);
  });

  it("uses sheetName in the range when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updates: { updatedRows: 1 } }),
    } as Response);

    const dest: GoogleSheetsDestination = {
      ...BASE_DESTINATION,
      sheetName: "My Sheet",
    };

    await appendSheetRow(VALID_CREDENTIALS, dest, BASE_FIELDS, TIMESTAMP);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("My%20Sheet");
  });
});
