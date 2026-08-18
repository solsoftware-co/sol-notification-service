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
import { monthlyAnalyticsScheduler } from "../../../../src/inngest/functions/monthly-analytics-scheduler";
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

const cronTrigger = { name: "analytics/monthly.scheduled" as const, data: {} };

// ---------------------------------------------------------------------------
// Test engine helper — captures sendEvent calls
// ---------------------------------------------------------------------------

function makeEngine(capturedEvents: any[]) {
  return new InngestTestEngine({
    function: monthlyAnalyticsScheduler,
    events: [cronTrigger],
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
  vi.mocked(config).env = "production";
});

// ---------------------------------------------------------------------------
// Cron + fan-out — scheduler no longer contains business-day loop
// ---------------------------------------------------------------------------

describe("fan-out — production, 3 clients", () => {
  it("dispatches 3 events immediately with last_month preset and scheduledAt ISO string", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents).execute();

    expect(capturedEvents).toHaveLength(3);
    capturedEvents.forEach((ev, i) => {
      expect(ev.name).toBe("analytics/report.requested");
      expect(ev.data.clientId).toBe(clients[i].id);
      expect(ev.data.reportPeriod).toEqual({ preset: "last_month" });
      expect(typeof ev.data.scheduledAt).toBe("string");
      expect(ev.data.enforceDeliveryWindow).toBe(true);
      // scheduledAt is a valid ISO timestamp
      expect(() => new Date(ev.data.scheduledAt)).not.toThrow();
    });
    expect((result as any).dispatched).toBe(3);
  });

  it("all dispatched events share the same scheduledAt timestamp", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    await makeEngine(capturedEvents).execute();

    const timestamps = capturedEvents.map((ev) => ev.data.scheduledAt);
    expect(new Set(timestamps).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Zero clients
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
// Non-production safety guard
// ---------------------------------------------------------------------------

describe("non-production environment filter", () => {
  it("calls getAllActiveClients with limit:1 in development", async () => {
    vi.mocked(config).env = "development";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents).execute();

    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      limit: 1,
    });
    expect(capturedEvents).toHaveLength(1);
    expect((result as any).dispatched).toBe(1);
  });

  it("production calls getAllActiveClients with limit:undefined", async () => {
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

// ---------------------------------------------------------------------------
// Manual trigger — analytics/monthly.scheduled
// ---------------------------------------------------------------------------

describe("manual trigger — analytics/monthly.scheduled", () => {
  it("fans out immediately on manual trigger with last_month preset", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    const engine = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [{ name: "analytics/monthly.scheduled" as const, data: {} }],
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

    const { result } = await engine.execute();
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].data.reportPeriod.preset).toBe("last_month");
    expect((result as any).dispatched).toBe(1);
  });
});
