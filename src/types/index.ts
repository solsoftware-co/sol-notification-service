export type AppEnv = "development" | "preview" | "production";
export type EmailMode = "mock" | "test" | "live" | "mailtrap";

export interface AppConfig {
  env: AppEnv;
  emailMode: EmailMode;
  testEmail: string | null;
  resendApiKey: string | null;
  resendFrom: string;
  databaseUrl: string;
  ga4CredentialsJson: string | null;
  logtailToken: string | null;
  mailtrapSmtpUser: string | null;
  mailtrapSmtpPass: string | null;
}

// ---------------------------------------------------------------------------
// Analytics report types
// ---------------------------------------------------------------------------

export type ReportPeriodPreset =
  | "last_week"
  | "last_month"
  | "last_30_days"
  | "last_90_days"
  | "custom";

export interface ReportPeriod {
  preset: ReportPeriodPreset;
  start?: string; // ISO 8601 date — required when preset === "custom"
  end?: string;   // ISO 8601 date — required when preset === "custom"
}

export interface ResolvedPeriod {
  start: string;             // ISO 8601 date, e.g. "2026-02-16"
  end: string;               // ISO 8601 date, e.g. "2026-02-22"
  label: string;             // Human-readable, e.g. "Feb 16 – Feb 22, 2026"
  preset: ReportPeriodPreset;
}

export interface TopPage {
  path: string;  // e.g. "/", "/about"
  views: number; // screenPageViews for the period
}

export interface TrafficSource {
  source: string;   // e.g. "google", "direct"
  sessions: number;
}

export interface DailyMetric {
  date: string;       // ISO 8601 date
  sessions: number;
  activeUsers: number;
  newUsers: number;
}

export interface HistoricalPeriodSnapshot {
  periodLabel: string;             // short label for bar chart, e.g. "Feb 2"
  sessions: number;
  activeUsers: number;
  newUsers: number;
  avgSessionDurationSecs: number;
}

export interface AnalyticsReport {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  avgSessionDurationSecs: number;
  topPages: TopPage[];
  topSources: TrafficSource[];
  dailyMetrics: DailyMetric[];
  resolvedPeriod: ResolvedPeriod;
  isMock: boolean;
  historicalPeriods?: HistoricalPeriodSnapshot[]; // up to 3 prior periods, oldest first
}

export interface AnalyticsReportRequestedPayload extends BaseEventPayload {
  // clientId inherited from BaseEventPayload
  reportPeriod: ReportPeriod;
  scheduledAt: string;    // ISO 8601 timestamp — used for preset resolution
  topSourcesLimit?: number; // overrides per-preset default (last_week=5, others=10)
  topPagesLimit?: number;   // overrides per-preset default (last_week=5, last_month=20, others=20)
}

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  ga4_property_id: string | null;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: Date | string; // Date from DB; Inngest step serialization yields string
}

export interface NotificationLogRow {
  id: number;
  client_id: string;
  workflow: string;
  event_name: string;
  outcome: "sent" | "failed" | "skipped";
  recipient_email: string | null;
  subject: string | null;
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface NotificationLogEntry {
  client_id: string;
  workflow: string;
  event_name: string;
  outcome: "sent" | "failed" | "skipped";
  recipient_email: string;
  subject: string;
  resend_id?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  content_id?: string;    // CID for inline images — no angle brackets, e.g. 'banner_image.png'
  content_type?: string;  // MIME type, e.g. 'image/png'
}

export interface EmailRenderResult {
  subject: string;
  html: string;
  previewText?: string;
  attachments: EmailAttachment[];
}

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
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

export interface FormSubmittedPayload extends BaseEventPayload {
  submitterName: string;
  submitterEmail: string;
  submitterMessage: string;
  formId?: string;
}
