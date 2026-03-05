// T010: email module unit tests
import type { EmailRequest } from "../../../src/types/index";

// vi.hoisted refs must be declared before the vi.mock calls that use them
const mockConfig = vi.hoisted(() => ({
  emailMode: "mock" as "mock" | "test" | "live",
  testEmail: null as string | null,
  resendApiKey: null as string | null,
  resendFrom: "no-reply@test.local",
}));

const mockEmailsSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

vi.mock("../../../src/lib/config", () => ({ config: mockConfig }));
vi.mock("../../../src/utils/logger", () => ({ log: vi.fn(), logError: vi.fn(), flush: vi.fn() }));
vi.mock("../../../src/utils/email-preview", () => ({
  writeEmailPreview: vi.fn(),
}));

// Imports after mocks
import { sendEmail } from "../../../src/lib/email";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const request: EmailRequest = {
  to: "owner@acme.com",
  subject: "New contact form submission",
  html: "<p>Hello world</p>",
};

// ---------------------------------------------------------------------------
describe("sendEmail", () => {
  beforeEach(() => {
    // clearAllMocks resets call history but keeps mock implementations
    vi.clearAllMocks();
    mockConfig.emailMode = "mock";
    mockConfig.testEmail = null;
    mockConfig.resendApiKey = null;
    mockConfig.resendFrom = "no-reply@test.local";
  });

  it("mock mode: returns logged outcome without calling Resend", async () => {
    const result = await sendEmail(request);

    expect(result.mode).toBe("mock");
    expect(result.outcome).toBe("logged");
    expect(result.originalTo).toBe("owner@acme.com");
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("test mode: redirects to testEmail and prefixes subject", async () => {
    mockConfig.emailMode = "test";
    mockConfig.testEmail = "dev@test.local";
    mockConfig.resendApiKey = "re_test";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg_test" }, error: null });

    const result = await sendEmail(request);

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dev@test.local" })
    );
    expect(result.actualTo).toBe("dev@test.local");
    expect(result.subject).toContain("[TEST: owner@acme.com]");
    expect(result.outcome).toBe("sent");
  });

  it("live mode: sends to original recipient with original subject", async () => {
    mockConfig.emailMode = "live";
    mockConfig.resendApiKey = "re_live";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg_live" }, error: null });

    const result = await sendEmail(request);

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@acme.com" })
    );
    expect(result.actualTo).toBe("owner@acme.com");
    expect(result.subject).toBe("New contact form submission");
    expect(result.outcome).toBe("sent");
  });
});
