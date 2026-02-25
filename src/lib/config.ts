import type { AppConfig, AppEnv, EmailMode } from "../types/index";

function deriveEnv(): AppEnv {
  const raw = process.env.VERCEL_ENV;
  if (raw === "preview") return "preview";
  if (raw === "production") return "production";
  return "development";
}

function deriveEmailMode(env: AppEnv): EmailMode {
  const override = process.env.EMAIL_MODE;
  if (override !== undefined) {
    if (override === "mock" || override === "test" || override === "live") {
      return override;
    }
    throw new Error(
      `EMAIL_MODE="${override}" is not recognized. Valid values: mock, test, live`
    );
  }
  if (env === "production") return "live";
  if (env === "preview") return "test";
  return "mock";
}

function buildConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const env = deriveEnv();
  const emailMode = deriveEmailMode(env);

  const testEmail = process.env.TEST_EMAIL ?? null;
  const resendApiKey = process.env.RESEND_API_KEY ?? null;
  const resendFrom =
    process.env.RESEND_FROM ?? "Notifications <notifications@example.com>";

  if (emailMode === "live" && !resendApiKey) {
    throw new Error(
      "EMAIL_MODE=live requires RESEND_API_KEY environment variable to be set"
    );
  }

  if (emailMode === "test" && !testEmail) {
    throw new Error(
      "EMAIL_MODE=test requires TEST_EMAIL environment variable to be set"
    );
  }

  return { env, emailMode, testEmail, resendApiKey, resendFrom, databaseUrl };
}

export const config: AppConfig = buildConfig();
