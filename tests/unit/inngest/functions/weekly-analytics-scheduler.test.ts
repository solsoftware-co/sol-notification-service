// T013 + T016 + T018: weekly-analytics-scheduler unit tests

const mockGetAllActiveClients = vi.hoisted(() => vi.fn());

// config MUST be mocked first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "production",
    emailMode: "live",
    resendApiKey: "re_test",
    resendFrom: "no-reply@test.local",
    solApiUrl: "https://sol-api-staging.solsoftware.workers.dev",
    solApiKey: "test-key",
    ga4CredentialsJson: null,
  },
}));

vi.mock("../../../../src/lib/sol-api", () => ({
  getAllActiveClients: mockGetAllActiveClients,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
  setRunContext: vi.fn(),
}));

import { InngestTestEngine, mockCtx } from "@inngest/test";
import { weeklyAnalyticsScheduler } from "../../../../src/inngest/functions/weekly-analytics-scheduler";
import { config } from "../../../../src/lib/config";
import type { ClientRecord } from "../../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClient(id: string, email: string): ClientRecord {
  return {
    id,
    name: `Client ${id}`,
    email,
    ga4_property_id: "123456789",
    active: true,
    settings: {},
    created_at: new Date(),
    google_service_account_email: null,
    google_service_account_key: null,
    slack_webhook_url: null,
    timezone: "America/Chicago",
  };
}

const clients = [
  makeClient("client-1", "test-one@example.com"),
  makeClient("client-2", "test-two@example.com"),
  makeClient("client-3", "test-three@example.com"),
];

const triggerEvent = { name: "analytics/weekly.scheduled" as const, data: {} };

// ---------------------------------------------------------------------------
// Build test engine with a captured sendEvent spy
// ---------------------------------------------------------------------------

function makeEngine(capturedEvents: any[]) {
  return new InngestTestEngine({
    function: weeklyAnalyticsScheduler,
    events: [triggerEvent],
    transformCtx: (ctx: any) => {
      const base = mockCtx(ctx);
      return {
        ...base,
        step: {
          ...base.step,
          sendEvent: async (_id: string, events: any) => {
            const arr = Array.isArray(events) ? events : [events];
            capturedEvents.push(...arr);
            return { ids: arr.map((_: any, i: number) => `mock-id-${i}`) };
          },
        },
      };
    },
  });
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  // Default to production for T013
  vi.mocked(config).env = "production";
});

// ---------------------------------------------------------------------------
// T013: Happy path — production fan-out
// ---------------------------------------------------------------------------

describe("fetch-active-clients step", () => {
  it("calls getAllActiveClients without a limit in production", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const t = new InngestTestEngine({
      function: weeklyAnalyticsScheduler,
      events: [triggerEvent],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("fetch-active-clients");

    expect(output.step.op).toBe("StepRun");
    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      limit: undefined,
    });
  });

  it("calls getAllActiveClients with limit:1 in development", async () => {
    vi.mocked(config).env = "development";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const t = new InngestTestEngine({
      function: weeklyAnalyticsScheduler,
      events: [triggerEvent],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("fetch-active-clients");

    expect(output.step.op).toBe("StepRun");
    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      limit: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// T013: Event payload shape
// ---------------------------------------------------------------------------

describe("fan-out — full execute, production, 3 clients", () => {
  it("dispatches 3 events each with last_week preset and a clientId", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents).execute();

    expect(capturedEvents).toHaveLength(3);
    capturedEvents.forEach((ev, i) => {
      expect(ev.name).toBe("analytics/report.requested");
      expect(ev.data.clientId).toBe(clients[i].id);
      expect(ev.data.reportPeriod).toEqual({ preset: "last_week" });
      expect(typeof ev.data.scheduledAt).toBe("string");
      expect(ev.data.enforceDeliveryWindow).toBe(true);
    });
    expect((result as any).dispatched).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// T016: Zero clients
// ---------------------------------------------------------------------------

describe("fan-out — zero active clients", () => {
  it("returns dispatched:0 and does not call sendEvent", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue([]);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents).execute();

    expect(capturedEvents).toHaveLength(0);
    expect((result as any).dispatched).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T018: Non-production safety — 1 event dispatched max
// ---------------------------------------------------------------------------

describe("non-production environment filter", () => {
  it("development with 3 clients → getAllActiveClients called with limit:1", async () => {
    vi.mocked(config).env = "development";
    // sol-api staging is a physically separate DB from production, so the
    // limit is purely a cost/speed cap now, not a safety filter.
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents).execute();

    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      limit: 1,
    });
    expect(capturedEvents).toHaveLength(1);
    expect((result as any).dispatched).toBe(1);
  });

  it("production with 3 clients → no limit applied", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    await makeEngine(capturedEvents).execute();

    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      limit: undefined,
    });
    expect(capturedEvents).toHaveLength(3);
  });
});
