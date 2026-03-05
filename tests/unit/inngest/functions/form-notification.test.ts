import { InngestTestEngine, mockCtx } from "@inngest/test";
import type { ClientRow, EmailResult } from "../../../../src/types/index";

// Hoisted mock refs — declared before vi.mock() factories
const mockRenderFormNotification = vi.hoisted(() => vi.fn());

// T006: Mock declarations — hoisted above all imports by Vitest
// config MUST be first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    databaseUrl: "postgresql://mock",
  },
}));

vi.mock("../../../../src/lib/db", () => ({
  getClientById: vi.fn(),
}));

vi.mock("../../../../src/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../../../src/lib/templates", () => ({
  renderFormNotificationEmail: mockRenderFormNotification,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
}));

// Imports after mocks
import { sendFormNotification } from "../../../../src/inngest/functions/form-notification";
import { getClientById } from "../../../../src/lib/db";
import { sendEmail } from "../../../../src/lib/email";

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

const validEvent = {
  name: "form/submitted" as const,
  data: {
    clientId: "client-acme",
    submitterName: "Jane Smith",
    submitterEmail: "jane@example.com",
    submitterMessage: "Hi, I'd like a quote.",
    formId: "contact",
  },
};

const mockClient: ClientRow = {
  id: "client-acme",
  name: "Acme Corp",
  email: "owner@acme.com",
  active: true,
  ga4_property_id: null,
  settings: {},
  created_at: new Date(),
};

const mockEmailResult: EmailResult = {
  mode: "mock",
  originalTo: "owner@acme.com",
  actualTo: "owner@acme.com",
  subject: "New inquiry — Acme Corp",
  outcome: "logged",
};

const mockRenderResult = {
  subject: "New inquiry — Acme Corp",
  html: "<html>mock</html>",
  attachments: [],
};

// ---------------------------------------------------------------------------
// Test engine (one instance, reused via clone for per-test variants)
// ---------------------------------------------------------------------------

const t = new InngestTestEngine({
  function: sendFormNotification,
  events: [validEvent],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformCtx: (ctx: any) => mockCtx(ctx),
});

// ---------------------------------------------------------------------------
// T007: Test cases
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockRenderFormNotification.mockResolvedValue(mockRenderResult);
});

// ---------------------------------------------------------------------------
describe("validate-payload", () => {
  it("succeeds when all required fields are present", async () => {
    const output = await t.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
  });

  it("throws when submitterEmail is missing", async () => {
    const tMissing = t.clone({
      events: [
        {
          ...validEvent,
          data: { ...validEvent.data, submitterEmail: "" },
        },
      ],
    });
    const output = await tMissing.executeStep("validate-payload");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe(
      "Missing required field: submitterEmail"
    );
  });

  it("throws when clientId is missing", async () => {
    const tMissing = t.clone({
      events: [
        {
          ...validEvent,
          data: { ...validEvent.data, clientId: "" },
        },
      ],
    });
    const output = await tMissing.executeStep("validate-payload");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe(
      "Missing required field: clientId"
    );
  });
});

// ---------------------------------------------------------------------------
describe("fetch-client-config", () => {
  it("returns the client when getClientById resolves", async () => {
    vi.mocked(getClientById).mockResolvedValue(mockClient);

    const output = await t.executeStep("fetch-client-config");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual(mockClient);
    expect(getClientById).toHaveBeenCalledOnce();
    expect(getClientById).toHaveBeenCalledWith("client-acme");
  });

  it("throws when client is not found", async () => {
    vi.mocked(getClientById).mockRejectedValue(
      new Error("Client not found: bad-id")
    );

    const output = await t.executeStep("fetch-client-config");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe("Client not found: bad-id");
  });

  it("throws when client is inactive", async () => {
    vi.mocked(getClientById).mockRejectedValue(
      new Error("Client inactive: client-acme")
    );

    const output = await t.executeStep("fetch-client-config");
    expect(output.step.op).toBe("StepError");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((output.step.error as any)?.message).toBe("Client inactive: client-acme");
  });
});

// ---------------------------------------------------------------------------
describe("send-email", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);
  });

  it("calls renderFormNotificationEmail with payload and client, then sendEmail with rendered result", async () => {
    const tWithClient = t.clone({
      steps: [{ id: "fetch-client-config", handler: () => mockClient }],
    });

    await tWithClient.executeStep("send-email");

    expect(mockRenderFormNotification).toHaveBeenCalledOnce();
    expect(mockRenderFormNotification).toHaveBeenCalledWith(
      expect.objectContaining({ submitterName: "Jane Smith" }),
      mockClient,
    );
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@acme.com",
        subject: "New inquiry — Acme Corp",
      })
    );
  });

  it("returns the EmailResult from sendEmail", async () => {
    const tWithClient = t.clone({
      steps: [{ id: "fetch-client-config", handler: () => mockClient }],
    });

    const output = await tWithClient.executeStep("send-email");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual(mockEmailResult);
  });
});

// ---------------------------------------------------------------------------
describe("full execute", () => {
  beforeEach(() => {
    vi.mocked(getClientById).mockResolvedValue(mockClient);
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);
  });

  it("returns the expected final payload", async () => {
    const { result } = await t.execute();

    expect(result).toEqual({
      clientId: "client-acme",
      outcome: "logged",
    });
  });
});
