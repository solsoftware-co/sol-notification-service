import { InngestTestEngine, mockCtx } from "@inngest/test";
import type { ClientRow, EmailResult } from "../../../../src/types/index";

// Hoisted mock refs — declared before vi.mock() factories
const mockRenderFormNotification = vi.hoisted(() => vi.fn());
const mockWriteNotificationLog = vi.hoisted(() => vi.fn());
const mockResolveRecipients = vi.hoisted(() => vi.fn());

// T006: Mock declarations — hoisted above all imports by Vitest
// config MUST be first to prevent throw-at-import from buildConfig()
vi.mock("../../../../src/lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    solApiUrl: "https://sol-api-staging.solsoftware.workers.dev",
    solApiKey: "test-key",
  },
}));

vi.mock("../../../../src/lib/sol-api", () => ({
  getClientById: vi.fn(),
  writeNotificationLog: mockWriteNotificationLog,
}));

vi.mock("../../../../src/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../../../src/lib/notifications", () => ({
  resolveRecipients: mockResolveRecipients,
}));

vi.mock("../../../../src/lib/templates", () => ({
  renderFormNotificationEmail: mockRenderFormNotification,
}));

vi.mock("../../../../src/utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  flush: vi.fn(),
  setRunContext: vi.fn(),
}));

// Imports after mocks
import { sendFormNotification } from "../../../../src/inngest/functions/form-notification";
import { getClientById } from "../../../../src/lib/sol-api";
import { sendEmail } from "../../../../src/lib/email";
import { resolveRecipients } from "../../../../src/lib/notifications";
import { config } from "../../../../src/lib/config";

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
  google_service_account_email: null,
  google_service_account_key: null,
};

const mockEmailResult: EmailResult = {
  mode: "mock",
  originalTo: ["owner@acme.com"],
  actualTo: ["owner@acme.com"],
  subject: "New inquiry — Acme Corp",
  outcome: "logged",
};

const mockLiveEmailResult: EmailResult = {
  mode: "live",
  originalTo: ["owner@acme.com"],
  actualTo: ["owner@acme.com"],
  subject: "New inquiry — Acme Corp",
  outcome: "sent",
  resendId: "resend-xyz789",
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

// Fresh engine per test — avoids @inngest/test step result caching between tests
function freshEngine() {
  return new InngestTestEngine({
    function: sendFormNotification,
    events: [validEvent],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformCtx: (ctx: any) => mockCtx(ctx),
  });
}

// ---------------------------------------------------------------------------
// T007: Test cases
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  (config as any).emailMode = "mock"; // reset to default before each test
  mockRenderFormNotification.mockResolvedValue(mockRenderResult);
  // Default: no preferences configured — resolveRecipients falls back to client.email
  mockResolveRecipients.mockReturnValue({ recipients: ["owner@acme.com"], source: "client_email" });
});

// ---------------------------------------------------------------------------
describe("validate-payload", () => {
  it("succeeds when clientId is present", async () => {
    const output = await t.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
  });

  it("succeeds with only clientId (no optional fields)", async () => {
    const tMinimal = t.clone({
      events: [
        {
          name: "form/submitted" as const,
          data: { clientId: "client-acme" },
        },
      ],
    });
    const output = await tMinimal.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
  });

  it("succeeds with clientId + submitterEmail only", async () => {
    const tEmailOnly = t.clone({
      events: [
        {
          name: "form/submitted" as const,
          data: { clientId: "client-acme", submitterEmail: "jane@example.com" },
        },
      ],
    });
    const output = await tEmailOnly.executeStep("validate-payload");
    expect(output.step.op).toBe("StepRun");
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
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
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
        to: ["owner@acme.com"],
        subject: "New inquiry — Acme Corp",
      })
    );
  });

  it("returns the EmailResult from sendEmail", async () => {
    const tWithClient = t.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
    });

    const output = await tWithClient.executeStep("send-email");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual(mockEmailResult);
  });
});

// ---------------------------------------------------------------------------
describe("resolve-recipients — notification preferences", () => {
  it("calls resolveRecipients with client, workflowKey, and payload recipients", async () => {
    const tWithClient = t.clone({
      steps: [{ id: "fetch-client-config", handler: () => mockClient }],
    });

    await tWithClient.executeStep("resolve-recipients");

    // data.recipients is undefined in validEvent — passed as third arg
    expect(resolveRecipients).toHaveBeenCalledWith(mockClient, "form_submitted", undefined);
  });

  it("uses configured form_submitted recipient list when resolveRecipients returns settings tier", async () => {
    const preferenceList = ["sales@acme.com", "manager@acme.com"];
    mockResolveRecipients.mockReturnValue({ recipients: preferenceList, source: "settings" });

    const tWithClient = t.clone({
      steps: [{ id: "fetch-client-config", handler: () => mockClient }],
    });

    const output = await tWithClient.executeStep("resolve-recipients");
    expect(output.step.data).toEqual({ recipients: preferenceList, source: "settings" });
  });

  it("falls back to [client.email] when resolveRecipients returns client_email tier", async () => {
    mockResolveRecipients.mockReturnValue({ recipients: ["owner@acme.com"], source: "client_email" });

    const tWithClient = t.clone({
      steps: [{ id: "fetch-client-config", handler: () => mockClient }],
    });

    const output = await tWithClient.executeStep("resolve-recipients");
    expect(output.step.data).toEqual({ recipients: ["owner@acme.com"], source: "client_email" });
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

// ---------------------------------------------------------------------------
// T009: log-result step — writeNotificationLog guard
// ---------------------------------------------------------------------------

describe("log-result — emailMode live", () => {
  it("calls writeNotificationLog with correct fields and formData metadata", async () => {
    (config as any).emailMode = "live";
    vi.mocked(getClientById).mockResolvedValue(mockClient);
    vi.mocked(sendEmail).mockResolvedValue(mockLiveEmailResult);

    await freshEngine().execute();

    expect(mockWriteNotificationLog).toHaveBeenCalledOnce();
    expect(mockWriteNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-acme",
        workflow: "send-form-notification",
        event_name: "form/submitted",
        outcome: "sent",
        recipient_email: "owner@acme.com", // joined from ["owner@acme.com"]
        subject: "New inquiry — Acme Corp",
        resend_id: "resend-xyz789",
        metadata: expect.objectContaining({
          formData: expect.objectContaining({ submitterName: "Jane Smith" }),
        }),
      })
    );
  });
});

describe("log-result — emailMode mock", () => {
  it("does not call writeNotificationLog", async () => {
    vi.mocked(getClientById).mockResolvedValue(mockClient);
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);

    await t.execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

describe("log-result — emailMode test", () => {
  it("does not call writeNotificationLog", async () => {
    (config as any).emailMode = "test";
    vi.mocked(getClientById).mockResolvedValue(mockClient);
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);

    await t.execute();

    expect(mockWriteNotificationLog).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T009/T010: sendEmail payload control
// ---------------------------------------------------------------------------

describe("send-email — sendEmail: false skip", () => {
  it("returns { skipped: true } and does not call sendEmail when sendEmail: false", async () => {
    const eventWithSkip = {
      name: "form/submitted" as const,
      data: { ...validEvent.data, sendEmail: false },
    };
    const tSkip = new InngestTestEngine({
      function: sendFormNotification,
      events: [eventWithSkip],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const tWithClient = tSkip.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
    });

    const output = await tWithClient.executeStep("send-email");

    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual({ skipped: true, reason: "sendEmail=false" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockRenderFormNotification).not.toHaveBeenCalled();
  });

  it("calls sendEmail when sendEmail: true (explicit)", async () => {
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);
    const eventExplicitTrue = {
      name: "form/submitted" as const,
      data: { ...validEvent.data, sendEmail: true },
    };
    const tTrue = new InngestTestEngine({
      function: sendFormNotification,
      events: [eventExplicitTrue],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const tWithClient = tTrue.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
    });

    const output = await tWithClient.executeStep("send-email");

    expect(output.step.op).toBe("StepRun");
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("calls sendEmail when sendEmail is absent (default true)", async () => {
    vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);
    const tWithClient = t.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
    });

    await tWithClient.executeStep("send-email");

    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("sync-to-google-sheets step still runs when sendEmail: false (controls are independent)", async () => {
    const sheetsEvent = {
      name: "form/submitted" as const,
      data: {
        ...validEvent.data,
        sendEmail: false,
        sheetsDestination: { spreadsheetId: "fake-id" },
      },
    };
    const tSheets = new InngestTestEngine({
      function: sendFormNotification,
      events: [sheetsEvent],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const tWithClient = tSheets.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
        { id: "send-email", handler: () => ({ skipped: true, reason: "sendEmail=false" }) },
      ],
    });

    // sync-to-google-sheets should still execute (skipped for no credentials, but step runs)
    const output = await tWithClient.executeStep("sync-to-google-sheets");
    expect(output.step.op).toBe("StepRun");
    expect(output.step.data).toEqual(expect.objectContaining({ skipped: true }));
  });
});

// T010: sendEmail: false + ctaButton are independent
describe("send-email — sendEmail: false + ctaButton (controls are independent)", () => {
  it("no email sent when sendEmail: false even if ctaButton is provided", async () => {
    const combinedEvent = {
      name: "form/submitted" as const,
      data: {
        ...validEvent.data,
        sendEmail: false,
        ctaButton: { text: "Ignored", action: { type: "url" as const, url: "https://example.com" } },
      },
    };
    const tCombined = new InngestTestEngine({
      function: sendFormNotification,
      events: [combinedEvent],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformCtx: (ctx: any) => mockCtx(ctx),
    });
    const tWithClient = tCombined.clone({
      steps: [
        { id: "fetch-client-config", handler: () => mockClient },
        { id: "resolve-recipients", handler: () => ({ recipients: ["owner@acme.com"], source: "client_email" }) },
      ],
    });

    const output = await tWithClient.executeStep("send-email");

    expect(output.step.data).toEqual({ skipped: true, reason: "sendEmail=false" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockRenderFormNotification).not.toHaveBeenCalled();
  });
});
