import { InngestTestEngine, mockCtx } from "@inngest/test";

// Hoisted mock refs — declared before vi.mock() factories
const mockGetClientSlackCredentials = vi.hoisted(() => vi.fn());
const mockWriteNotificationLog = vi.hoisted(() => vi.fn());
const mockPostSlackMessage = vi.hoisted(() => vi.fn());

// config MUST be first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    solApiUrl: "https://sol-api-staging.solsoftware.workers.dev",
    solApiKey: "test-key",
  },
}));

vi.mock("../../../../src/lib/sol-api", () => ({
  getClientSlackCredentials: mockGetClientSlackCredentials,
  writeNotificationLog: mockWriteNotificationLog,
}));

vi.mock("../../../../src/lib/slack", () => ({
  postSlackMessage: mockPostSlackMessage,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
  setRunContext: vi.fn(),
}));

// Imports after mocks
import { sendSlackMessage } from "../../../../src/inngest/functions/slack-notification";
import { config } from "../../../../src/lib/config";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validEvent = {
  name: "slack/message.requested" as const,
  data: {
    clientId: "client-acme",
    text: "New form submission from jane@example.com",
  },
};

// ---------------------------------------------------------------------------

const t = new InngestTestEngine({
  function: sendSlackMessage,
  events: [validEvent],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformCtx: (ctx: any) => mockCtx(ctx),
});

function freshEngine() {
  return new InngestTestEngine({
    function: sendSlackMessage,
    events: [validEvent],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformCtx: (ctx: any) => mockCtx(ctx),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  (config as any).env = "development"; // reset to default before each test
  mockGetClientSlackCredentials.mockResolvedValue({
    slack_webhook_url: "https://hooks.slack.com/services/xyz",
  });
  mockPostSlackMessage.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
describe("validate-payload", () => {
  it("succeeds when clientId and text are present", async () => {
    const output = await t.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
  });

  it("throws when clientId is missing", async () => {
    const tMissing = t.clone({
      events: [{ ...validEvent, data: { ...validEvent.data, clientId: "" } }],
    });
    const output = await tMissing.executeStep("validate-payload");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe("Missing required field: clientId");
  });

  it("throws when text is missing", async () => {
    const tMissing = t.clone({
      events: [{ ...validEvent, data: { ...validEvent.data, text: "" } }],
    });
    const output = await tMissing.executeStep("validate-payload");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe("Missing required field: text");
  });
});

// ---------------------------------------------------------------------------
describe("send-slack-message", () => {
  it("posts to the client's webhook when one is configured", async () => {
    const output = await t.executeStep("send-slack-message");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual({ skipped: false });
    expect(mockGetClientSlackCredentials).toHaveBeenCalledWith("client-acme");
    expect(mockPostSlackMessage).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/xyz",
      { text: validEvent.data.text, blocks: undefined }
    );
  });

  it("skips without calling postSlackMessage when the client has no webhook configured", async () => {
    mockGetClientSlackCredentials.mockResolvedValue({ slack_webhook_url: null });

    const output = await t.executeStep("send-slack-message");

    expect(output.step.data).toEqual({
      skipped: true,
      reason: "no Slack webhook configured for client",
    });
    expect(mockPostSlackMessage).not.toHaveBeenCalled();
  });

  it("passes blocks through when provided", async () => {
    const blocks = [{ type: "section", text: { type: "mrkdwn", text: "*Bold*" } }];
    const tWithBlocks = t.clone({
      events: [{ ...validEvent, data: { ...validEvent.data, blocks } }],
    });

    await tWithBlocks.executeStep("send-slack-message");

    expect(mockPostSlackMessage).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/xyz",
      { text: validEvent.data.text, blocks }
    );
  });
});

// ---------------------------------------------------------------------------
describe("log-result", () => {
  it("writes a sent notification log", async () => {
    await freshEngine().execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-acme",
        workflow: "send-slack-message",
        event_name: "slack/message.requested",
        outcome: "sent",
      })
    );
  });

  it("does not write a log when skipped (no webhook)", async () => {
    mockGetClientSlackCredentials.mockResolvedValue({ slack_webhook_url: null });

    await freshEngine().execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });

  it("still writes the log in non-production environments", async () => {
    (config as any).env = "preview";

    await freshEngine().execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("full execute", () => {
  it("returns the expected final payload", async () => {
    const { result } = await freshEngine().execute();

    expect(result).toEqual({ clientId: "client-acme", outcome: "sent" });
  });

  it("returns outcome: skipped when no webhook is configured", async () => {
    mockGetClientSlackCredentials.mockResolvedValue({ slack_webhook_url: null });

    const { result } = await freshEngine().execute();

    expect(result).toEqual({ clientId: "client-acme", outcome: "skipped" });
  });
});

// ---------------------------------------------------------------------------
// onFailure — fires after retries are exhausted
// ---------------------------------------------------------------------------

function fakeFailureArgs() {
  return {
    event: {
      data: {
        run_id: "run-exhausted-1",
        function_id: "send-slack-message",
        event: { data: { ...validEvent.data } },
        error: { name: "Error", message: "Slack webhook 500: internal_error" },
      },
    },
    error: new Error("Slack webhook 500: internal_error"),
    step: { run: async (_id: string, fn: () => unknown) => fn() },
  };
}

describe("onFailure", () => {
  it("writes a failed notification log", async () => {
    const onFailure = (sendSlackMessage as any).onFailureFn;

    await onFailure(fakeFailureArgs());

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-acme",
        workflow: "send-slack-message",
        event_name: "slack/message.requested",
        outcome: "failed",
        error_message: "Slack webhook 500: internal_error",
      })
    );
  });

  it("writes the failed log regardless of environment", async () => {
    (config as any).env = "preview";
    const onFailure = (sendSlackMessage as any).onFailureFn;

    await onFailure(fakeFailureArgs());

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
  });
});
