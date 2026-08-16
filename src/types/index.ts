export type AppEnv = "development" | "preview" | "production";

export const SUPPORTED_TIMEZONES = [
  "America/New_York",    // Eastern Time (EST/EDT)
  "America/Chicago",     // Central Time (CST/CDT) — default
  "America/Denver",      // Mountain Time (MST/MDT)
  "America/Los_Angeles", // Pacific Time (PST/PDT)
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

export function isValidTimezone(tz: unknown): tz is SupportedTimezone {
  return SUPPORTED_TIMEZONES.includes(tz as SupportedTimezone);
}
export type EmailMode = "mock" | "test" | "live" | "mailtrap";

export interface AppConfig {
  env: AppEnv;
  emailMode: EmailMode;
  resendApiKey: string | null;
  resendFrom: string;
  solApiUrl: string;
  solApiKey: string;
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
  periodStart: string;             // ISO 8601 start date, e.g. "2026-02-02" — used for preset-aware label formatting
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
  /**
   * When true, the worker waits until 9 AM in the client's local timezone on the
   * next business day before sending. Set by schedulers; defaults to false so
   * manual triggers send immediately.
   */
  enforceDeliveryWindow?: boolean;
  /**
   * Optional per-invocation recipient override.
   * When present and valid, these addresses receive the report
   * instead of the stored settings or client.email.
   * Invalid entries are discarded; empty array treated as absent.
   */
  recipients?: string[];
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  ga4_property_id: string | null;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: Date | string; // Date from DB; Inngest step serialization yields string
  google_service_account_email: string | null;
  google_service_account_key: string | null;
  timezone: SupportedTimezone;
}

/**
 * ClientRecord without the Google service-account credential. Steps that only
 * need identity/config fields (recipients, rendering, timezone resolution)
 * should be typed on this, not ClientRecord, so the credential can't leak into
 * a step's persisted output via those code paths.
 */
export type ClientSummary = Omit<ClientRecord, "google_service_account_key">;

/** The Google service-account credential, fetched separately via getClientGoogleCredentials(). */
export type ClientGoogleCredentials = Pick<ClientRecord, "google_service_account_key">;

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
  banner?: ClientBannerConfig;
}

export interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  mode: EmailMode;
  originalTo: string | string[];
  subject: string;
  outcome: "sent" | "logged";
  resendId?: string;
}

export interface BaseEventPayload {
  clientId: string;
}

/** Manual trigger payload for analytics/monthly.scheduled — no required fields. */
export interface MonthlyScheduledPayload {}

/** Per-client banner image configuration stored in clients.settings.banner */
export interface ClientBannerConfig {
  /** Absolute URL (http/https) to the banner image to embed in emails. */
  imageUrl?: string;
  /** Display height in pixels. Must be a positive integer. Defaults to 40. */
  height?: number;
  /** Display width in pixels. Must be a positive integer. No default (natural scaling). */
  width?: number;
}

export interface GoogleSheetsDestination {
  /** ID of the target Google Spreadsheet (from the sheet URL). */
  spreadsheetId: string;
  /** Tab/sheet name within the spreadsheet. Defaults to the first sheet if omitted. */
  sheetName?: string;
  /**
   * Ordered list of field identifiers mapping submission fields to columns.
   * Use "_timestamp" for the submission timestamp.
   * If omitted: writes [timestamp, ...all form fields in received order].
   */
  columns?: string[];
  /** Cell reference for the top-left corner of the target table, e.g. "B2". Defaults to "A1". */
  tableAnchor?: string;
}

export interface RecipientResolutionResult {
  /** Final deduplicated recipient list — always non-empty. */
  recipients: string[];
  /** Which tier of the fallback chain produced the list. */
  source: "payload" | "settings" | "client_email";
}

/** Configures the call-to-action button in a form notification email. */
export type FormNotificationCtaButton = {
  /** Optional label override for the CTA button. Empty string falls back to default. */
  text?: string;
  /** Optional action. Absent = default mailto to submitter's email. */
  action?:
    | { type: "url"; url: string }
    | { type: "mailto"; email?: string };
};

export interface FormSubmittedPayload extends BaseEventPayload {
  submitterName?: string;
  submitterEmail?: string;
  submitterMessage?: string;
  submitterPhone?: string;
  submittedFrom?: string;
  formName?: string;
  customFields?: Record<string, string>;
  /** @deprecated Use formName instead. Silently ignored by the notification service. */
  formId?: string;
  /**
   * Optional Google Sheets destination. When present (and the client has
   * credentials registered), the workflow appends a row to the specified
   * sheet after sending the email.
   */
  sheetsDestination?: GoogleSheetsDestination;
  /**
   * Optional per-invocation recipient override.
   * When present and valid, these addresses receive the notification
   * instead of the stored settings or client.email.
   * Invalid entries are discarded; empty array treated as absent.
   */
  recipients?: string[];
  /**
   * When false, the email send step is skipped for this submission.
   * Other steps (e.g. Google Sheets sync) still execute normally.
   * Defaults to true when omitted.
   */
  sendEmail?: boolean;
  /**
   * Optional CTA button override for the notification email.
   * Supports mailto (default) and url action types.
   * Omitting preserves the default "Reply to {submitter}" button.
   */
  ctaButton?: FormNotificationCtaButton;
  /**
   * Optional title override for the notification email header.
   * Defaults to "New Inquiry" when omitted.
   */
  notificationTitle?: string;
}
