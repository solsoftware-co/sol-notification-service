// config.test.ts — config module unit tests
// config.ts calls buildConfig() at module load, which throws if SOL_API_URL
// or SOL_API_KEY is absent. Use vi.resetModules() + dynamic import() so each
// test gets a fresh evaluation with the process.env values it sets.

const ENV_KEYS = [
  "SOL_API_URL",
  "SOL_API_KEY",
  "VERCEL_ENV",
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

  it("no VERCEL_ENV + sol-api config → env=development, emailMode=mock", async () => {
    process.env.SOL_API_URL = "https://sol-api-staging.solsoftware.workers.dev";
    process.env.SOL_API_KEY = "test-key";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("development");
    expect(config.emailMode).toBe("mock");
    expect(config.resendApiKey).toBeNull();
  });

  it("VERCEL_ENV=preview → env=preview, emailMode=test", async () => {
    process.env.SOL_API_URL = "https://sol-api-staging.solsoftware.workers.dev";
    process.env.SOL_API_KEY = "test-key";
    process.env.VERCEL_ENV = "preview";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("preview");
    expect(config.emailMode).toBe("test");
  });

  it("VERCEL_ENV=production + RESEND_API_KEY → env=production, emailMode=live", async () => {
    process.env.SOL_API_URL = "https://sol-api.solsoftware.workers.dev";
    process.env.SOL_API_KEY = "test-key";
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";

    const { config } = await import("../../../src/lib/config");

    expect(config.env).toBe("production");
    expect(config.emailMode).toBe("live");
    expect(config.resendApiKey).toBe("re_test_key");
  });

  it("throws when SOL_API_URL is absent", async () => {
    process.env.SOL_API_KEY = "test-key";

    await expect(import("../../../src/lib/config")).rejects.toThrow(
      /SOL_API_URL/
    );
  });

  it("throws when SOL_API_KEY is absent", async () => {
    process.env.SOL_API_URL = "https://sol-api-staging.solsoftware.workers.dev";

    await expect(import("../../../src/lib/config")).rejects.toThrow(
      /SOL_API_KEY/
    );
  });
});
