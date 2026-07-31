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
    if (override === "mock" || override === "test" || override === "live" || override === "mailtrap") {
      return override;
    }
    throw new Error(
      `EMAIL_MODE="${override}" is not recognized. Valid values: mock, test, live, mailtrap`
    );
  }
  if (env === "production") return "live";
  if (env === "preview") return "test";
  return "mock";
}

function buildConfig(): AppConfig {
  const solApiUrl = process.env.SOL_API_URL;
  if (!solApiUrl) {
    throw new Error("SOL_API_URL environment variable is not set");
  }

  const solApiKey = process.env.SOL_API_KEY;
  if (!solApiKey) {
    throw new Error("SOL_API_KEY environment variable is not set");
  }

  const env = deriveEnv();
  const emailMode = deriveEmailMode(env);

  const resendApiKey = process.env.RESEND_API_KEY ?? null;
  const resendFrom =
    process.env.RESEND_FROM ?? "Notifications <notifications@example.com>";
  const mailtrapSmtpUser = process.env.MAILTRAP_SMTP_USER ?? null;
  const mailtrapSmtpPass = process.env.MAILTRAP_SMTP_PASS ?? null;

  if (emailMode === "live" && !resendApiKey) {
    throw new Error(
      "EMAIL_MODE=live requires RESEND_API_KEY environment variable to be set"
    );
  }

  if (emailMode === "mailtrap" && (!mailtrapSmtpUser || !mailtrapSmtpPass)) {
    throw new Error(
      "EMAIL_MODE=mailtrap requires MAILTRAP_SMTP_USER and MAILTRAP_SMTP_PASS environment variables to be set"
    );
  }

  const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN ?? null;

  return { env, emailMode, resendApiKey, resendFrom, solApiUrl, solApiKey, logtailToken, mailtrapSmtpUser, mailtrapSmtpPass };
}

export const config: AppConfig = buildConfig();
