const mockGetAllActiveClients = vi.hoisted(() => vi.fn());

// config MUST be mocked first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "production",
    emailMode: "live",
    testEmail: null,
    resendApiKey: "re_test",
    resendFrom: "no-reply@test.local",
    databaseUrl: "postgresql://mock",
    ga4CredentialsJson: null,
  },
}));

vi.mock("../../../../src/lib/db", () => ({
  getAllActiveClients: mockGetAllActiveClients,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));

import { InngestTestEngine, mockCtx } from "@inngest/test";
import { monthlyAnalyticsScheduler } from "../../../../src/inngest/functions/monthly-analytics-scheduler";
import { config } from "../../../../src/lib/config";
import type { ClientRow } from "../../../../src/types/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClient(id: string, email: string): ClientRow {
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
  };
}

const clients = [
  makeClient("client-1", "test-one@example.com"),
  makeClient("client-2", "test-two@example.com"),
  makeClient("client-3", "test-three@example.com"),
];

// Monday 2026-04-06 09:00 UTC (known weekday, non-holiday)
const WEEKDAY_ANCHOR = "2026-04-06T09:00:00.000Z";
// Saturday 2026-04-04 09:00 UTC
const SATURDAY_ANCHOR = "2026-04-04T09:00:00.000Z";

const cronTrigger = { name: "analytics/monthly.scheduled" as const, data: {} };

// ---------------------------------------------------------------------------
// Test engine helper — injects a pre-computed anchor date
// ---------------------------------------------------------------------------

function makeEngine(
  capturedEvents: any[],
  anchorDate: string,
  overrideSteps: any[] = []
) {
  return new InngestTestEngine({
    function: monthlyAnalyticsScheduler,
    events: [cronTrigger],
    steps: [
      { id: "capture-trigger-date", handler: () => anchorDate },
      ...overrideSteps,
    ],
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
// check-business-day-0 step
// ---------------------------------------------------------------------------

describe("check-business-day-0 step", () => {
  it("returns true when anchor is a weekday non-holiday", async () => {
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [cronTrigger],
      steps: [{ id: "capture-trigger-date", handler: () => WEEKDAY_ANCHOR }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-0");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe(true);
  });

  it("returns false when anchor is a Saturday", async () => {
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [cronTrigger],
      steps: [{ id: "capture-trigger-date", handler: () => SATURDAY_ANCHOR }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-0");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full execute — weekday anchor (US1: happy path)
// ---------------------------------------------------------------------------

describe("fan-out — weekday anchor, production, 3 clients", () => {
  it("dispatches 3 events each with last_month preset and a clientId", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents, WEEKDAY_ANCHOR, [
      { id: "check-business-day-0", handler: () => true },
    ]).execute();

    expect(capturedEvents).toHaveLength(3);
    capturedEvents.forEach((ev, i) => {
      expect(ev.name).toBe("analytics/report.requested");
      expect(ev.data.clientId).toBe(clients[i].id);
      expect(ev.data.reportPeriod).toEqual({ preset: "last_month" });
      expect(typeof ev.data.scheduledAt).toBe("string");
    });
    expect((result as any).dispatched).toBe(3);
  });

  it("scheduledAt matches the resolved anchor date", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    await makeEngine(capturedEvents, WEEKDAY_ANCHOR, [
      { id: "check-business-day-0", handler: () => true },
    ]).execute();

    expect(capturedEvents[0].data.scheduledAt).toBe(WEEKDAY_ANCHOR);
  });
});

// ---------------------------------------------------------------------------
// Full execute — zero clients
// ---------------------------------------------------------------------------

describe("fan-out — zero active clients", () => {
  it("returns dispatched:0 and does not call sendEvent", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue([]);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents, WEEKDAY_ANCHOR, [
      { id: "check-business-day-0", handler: () => true },
    ]).execute();

    expect(capturedEvents).toHaveLength(0);
    expect((result as any).dispatched).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Non-production safety guard
// ---------------------------------------------------------------------------

describe("non-production environment filter", () => {
  it("calls getAllActiveClients with testOnly:true + limit:1 in development", async () => {
    vi.mocked(config).env = "development";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    const { result } = await makeEngine(capturedEvents, WEEKDAY_ANCHOR, [
      { id: "check-business-day-0", handler: () => true },
    ]).execute();

    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      testOnly: true,
      limit: 1,
    });
    expect(capturedEvents).toHaveLength(1);
    expect((result as any).dispatched).toBe(1);
  });

  it("production calls getAllActiveClients with testOnly:false, limit:undefined", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue(clients);

    const capturedEvents: any[] = [];
    await makeEngine(capturedEvents, WEEKDAY_ANCHOR, [
      { id: "check-business-day-0", handler: () => true },
    ]).execute();

    expect(mockGetAllActiveClients).toHaveBeenCalledWith({
      testOnly: false,
      limit: undefined,
    });
    expect(capturedEvents).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Weekend skip (US2) — Saturday anchor
// ---------------------------------------------------------------------------

describe("weekend skip — Saturday anchor", () => {
  it("check-business-day-0 returns false for Saturday anchor", async () => {
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [cronTrigger],
      steps: [{ id: "capture-trigger-date", handler: () => SATURDAY_ANCHOR }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-0");
    expect(output.step.data).toBe(false);
  });

  it("check-business-day-1 returns false for Sunday (anchor + 1 day)", async () => {
    // anchor = Saturday Apr 4 → +1 = Sunday Apr 5
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [cronTrigger],
      steps: [
        { id: "capture-trigger-date", handler: () => SATURDAY_ANCHOR },
        { id: "check-business-day-0", handler: () => false },
        { id: "sleep-until-day-1", handler: () => undefined },
      ],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-1");
    expect(output.step.data).toBe(false);
  });

  it("check-business-day-2 returns true for Monday (anchor + 2 days)", async () => {
    // anchor = Saturday Apr 4 → +2 = Monday Apr 6
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [cronTrigger],
      steps: [
        { id: "capture-trigger-date", handler: () => SATURDAY_ANCHOR },
        { id: "check-business-day-0", handler: () => false },
        { id: "sleep-until-day-1", handler: () => undefined },
        { id: "check-business-day-1", handler: () => false },
        { id: "sleep-until-day-2", handler: () => undefined },
      ],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-2");
    expect(output.step.data).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Manual trigger (US4) — analytics/monthly.scheduled event
// ---------------------------------------------------------------------------

describe("manual trigger — analytics/monthly.scheduled", () => {
  it("Saturday manual trigger → check-business-day-0 returns false (same as cron)", async () => {
    const t = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [{ name: "analytics/monthly.scheduled" as const, data: {} }],
      steps: [{ id: "capture-trigger-date", handler: () => SATURDAY_ANCHOR }],
      transformCtx: (ctx: any) => mockCtx(ctx),
    });

    const output = await t.executeStep("check-business-day-0");
    expect(output.step.data).toBe(false);
  });

  it("weekday manual trigger → dispatches last_month events immediately", async () => {
    vi.mocked(config).env = "production";
    mockGetAllActiveClients.mockResolvedValue([clients[0]]);

    const capturedEvents: any[] = [];
    const engine = new InngestTestEngine({
      function: monthlyAnalyticsScheduler,
      events: [{ name: "analytics/monthly.scheduled" as const, data: {} }],
      steps: [
        { id: "capture-trigger-date", handler: () => WEEKDAY_ANCHOR },
        { id: "check-business-day-0", handler: () => true },
      ],
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
