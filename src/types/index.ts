export type AppEnv = "development" | "preview" | "production";
export type EmailMode = "mock" | "test" | "live";

export interface AppConfig {
  env: AppEnv;
  emailMode: EmailMode;
  testEmail: string | null;
  resendApiKey: string | null;
  resendFrom: string;
  databaseUrl: string;
}

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  ga4_property_id: string | null;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: Date;
}

export interface NotificationLogRow {
  id: number;
  client_id: string;
  workflow: string;
  event_name: string;
  outcome: "success" | "failed" | "skipped";
  created_at: Date;
}

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  mode: EmailMode;
  originalTo: string;
  actualTo: string;
  subject: string;
  outcome: "sent" | "logged";
  resendId?: string;
}

export interface BaseEventPayload {
  clientId: string;
}
