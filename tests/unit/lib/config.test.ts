// T011: config module unit tests
// config.ts calls buildConfig() at module load, which throws if DATABASE_URL
// is absent. Use vi.resetModules() + dynamic import() so each test gets a
// fresh evaluation with the process.env values it sets.

const ENV_KEYS = [
  "DATABASE_URL",
  "VERCEL_ENV",
  "TEST_EMAIL",
  "RESEND_API_KEY",
  "EMAIL_MODE",
] as const;

describe("buildConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  it("no VERCEL_ENV + DATABASE_URL → env=development, emailMode=mock", async () => {
    process.env.DATABASE_URL = "postgresql://test";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("development");
    expect(config.emailMode).toBe("mock");
    expect(config.testEmail).toBeNull();
    expect(config.resendApiKey).toBeNull();
  });

  it("VERCEL_ENV=preview + TEST_EMAIL → env=preview, emailMode=test", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    process.env.VERCEL_ENV = "preview";
    process.env.TEST_EMAIL = "dev@test.local";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("preview");
    expect(config.emailMode).toBe("test");
    expect(config.testEmail).toBe("dev@test.local");
  });

  it("VERCEL_ENV=production + RESEND_API_KEY → env=production, emailMode=live", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("production");
    expect(config.emailMode).toBe("live");
    expect(config.resendApiKey).toBe("re_test_key");
  });

  it("throws when DATABASE_URL is absent", async () => {
    await expect(import("../../../src/lib/config")).rejects.toThrow(
      /DATABASE_URL/
    );
  });
});
