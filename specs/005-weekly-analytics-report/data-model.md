# Data Model: Weekly Analytics Report (005)

**Branch**: `005-weekly-analytics-report`
**Date**: 2026-02-28 (revised)

---

## Existing Schema (no changes required)

The `clients` table already has all columns needed for this feature:

```sql
-- Already exists — confirmed in src/lib/db.ts SELECT query and src/types/index.ts
CREATE TABLE clients (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  ga4_property_id TEXT,          -- NULL = no analytics configured for this client
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`ga4_property_id` stores the numeric GA4 property identifier (e.g., `"123456789"`). The service prefixes it with `"properties/"` when calling the GA4 Data API. A `NULL` value means the client has no analytics configured — the per-client workflow fails immediately with a "GA4 property not configured" error.

---

## New TypeScript Types (`src/types/index.ts`)

### `ReportPeriodPreset`

Identifies the date range strategy for an analytics report. Resolved to concrete ISO dates inside the per-client workflow.

```typescript
export type ReportPeriodPreset =
  | "last_week"    // Mon–Sun of the previous calendar week (default for Tuesday cron)
  | "last_month"   // Full previous calendar month
  | "last_30_days" // Rolling 30 days ending yesterday
  | "last_90_days" // Rolling 90 days ending yesterday
  | "custom";      // Explicit start + end required
```

### `ReportPeriod`

Encapsulates the period selection for a report request. When `preset` is `"custom"`, both `start` and `end` are required.

```typescript
export interface ReportPeriod {
  preset: ReportPeriodPreset;
  start?: string;  // ISO 8601 date — required when preset === "custom"
  end?: string;    // ISO 8601 date — required when preset === "custom"
}
```

### `ResolvedPeriod`

The concrete date range after preset resolution. Computed inside the per-client workflow from `ReportPeriod` + `scheduledAt`. Stored in the analytics report and included in the email subject/header.

```typescript
export interface ResolvedPeriod {
  start: string;  // ISO 8601 date, e.g. "2026-02-16"
  end: string;    // ISO 8601 date, e.g. "2026-02-22"
  label: string;  // Human-readable, e.g. "Feb 16 – Feb 22, 2026"
  preset: ReportPeriodPreset;
}
```

### `AnalyticsReportRequestedPayload`

Event payload for the `analytics/report.requested` event. Dispatched by the scheduler per active client.

```typescript
export interface AnalyticsReportRequestedPayload extends BaseEventPayload {
  // clientId inherited from BaseEventPayload
  reportPeriod: ReportPeriod;
  scheduledAt: string;  // ISO 8601 timestamp when the cron fired — used for preset resolution
}
```

### `TopPage`

One entry in the top-pages ranking from GA4.

```typescript
export interface TopPage {
  path: string;   // e.g. "/", "/about", "/contact"
  views: number;  // screenPageViews for the reporting period
}
```

### `TrafficSource`

One entry in the top traffic sources ranking from GA4.

```typescript
export interface TrafficSource {
  source: string;   // e.g. "google", "direct", "(none)"
  sessions: number;
}
```

### `DailyMetric`

One day's aggregated metrics, used to populate a daily trend series in the email.

```typescript
export interface DailyMetric {
  date: string;       // ISO 8601 date, e.g. "2026-02-16"
  sessions: number;
  activeUsers: number;
  newUsers: number;
}
```

### `AnalyticsReport`

Structured analytics data returned by `src/lib/analytics.ts`. Passed to the email builder.

```typescript
export interface AnalyticsReport {
  // Summary metrics
  sessions: number;
  activeUsers: number;
  newUsers: number;
  avgSessionDurationSecs: number;  // raw seconds; format as "Xm Ys" in the email

  // Ranked lists
  topPages: TopPage[];            // top 5 by screenPageViews
  topSources: TrafficSource[];    // top 5 by sessions

  // Daily trend (one entry per day in the resolved period)
  dailyMetrics: DailyMetric[];

  // Period metadata
  resolvedPeriod: ResolvedPeriod;

  isMock: boolean;  // true when data is synthetic (dev mode, no credentials)
}
```

---

## Updated `AppConfig` (`src/types/index.ts` + `src/lib/config.ts`)

One new field added to `AppConfig`:

```typescript
export interface AppConfig {
  env: AppEnv;
  emailMode: EmailMode;
  testEmail: string | null;
  resendApiKey: string | null;
  resendFrom: string;
  databaseUrl: string;
  ga4CredentialsJson: string | null;  // NEW: raw JSON string of GA4 service account
}
```

`ga4CredentialsJson` is read from `GA4_SERVICE_ACCOUNT_JSON` env var. It is:
- `null` in development (mock GA4 data returned instead)
- Required to be a valid JSON string in production (config throws if absent when `env === "production"`)

---

## New Module: `src/lib/analytics.ts`

Encapsulates all GA4 Data API interaction. No GA4 SDK calls exist outside this module.

### Exported function

```typescript
export async function getAnalyticsReport(
  propertyId: string,
  period: ResolvedPeriod
): Promise<AnalyticsReport>
```

### Internal query functions (mirrors previous implementation pattern)

```typescript
// sessions, activeUsers, newUsers by date — daily trend
function getReportData(propertyId, startDate, endDate): Promise<RunReportResponse>

// averageSessionDuration (aggregate, no dimension)
function getAverageSessionDuration(propertyId, startDate, endDate): Promise<RunReportResponse>

// sessions by sessionSource, desc — top traffic sources
function getTrafficSourceData(propertyId, startDate, endDate, limit?): Promise<RunReportResponse>

// screenPageViews by pagePath, desc — top pages
function getMostViewedPagesData(propertyId, startDate, endDate, limit?): Promise<RunReportResponse>
```

All internal functions share a single private `runReport()` helper with typed args (matching the existing pattern from `src/utils/ga4Reports.ts`).

**Behaviour**:
- If `config.ga4CredentialsJson` is `null` (dev/mock mode): logs a warning and returns mock data with `isMock: true`
- If credentials are present: runs 4 `runReport()` calls in parallel (daily metrics, avg duration, top sources, top pages), parses and merges the results
- All GA4 API errors propagate as-is so Inngest can retry the step automatically
- Empty `rows` response (zero-traffic period) → all counts default to 0, `topPages` / `topSources` / `dailyMetrics` default to `[]`

---

## Period Resolution

The per-client workflow resolves `ReportPeriod` → `ResolvedPeriod` in a dedicated step (`"resolve-report-period"`), using `scheduledAt` as the reference timestamp.

| Preset | Start | End | Label example |
|--------|-------|-----|---------------|
| `last_week` | Monday 8 days before `scheduledAt` | Sunday 2 days before `scheduledAt` | "Feb 16 – Feb 22, 2026" |
| `last_month` | 1st of the month before `scheduledAt` | Last day of that month | "Feb 1 – Feb 28, 2026" |
| `last_30_days` | Yesterday – 29 days | Yesterday | "Jan 30 – Feb 28, 2026" |
| `last_90_days` | Yesterday – 89 days | Yesterday | "Nov 30 – Feb 28, 2026" |
| `custom` | `period.start` (as-is) | `period.end` (as-is) | "Mar 1 – Mar 15, 2026" |

Cron fires Tuesday 09:00 UTC → yesterday = Monday → last Sunday = 2 days ago → last Monday = 8 days ago.
`last_week` therefore always covers the complete Mon–Sun calendar week that ended two days prior.

---

## New DB Helper: `src/lib/db.ts`

```typescript
export async function getAllActiveClients(options?: {
  testOnly?: boolean;
  limit?: number;
}): Promise<ClientRow[]>
```

**Query logic**:
- Base: `SELECT ... FROM clients WHERE active = TRUE`
- `testOnly: true` adds: `AND email LIKE '%test%'`
- `limit` adds: `LIMIT $n`
- Used by the scheduler to fetch the fan-out list
- Scheduler passes `{ testOnly: true, limit: 1 }` in non-production environments

---

## State & Lifecycle

```
Cron fires (Tuesday 09:00 UTC)
  OR analytics/weekly.scheduled event
        │
        ▼
weekly-analytics-scheduler
  ├── step: fetch-active-clients
  │     └── getAllActiveClients({ testOnly: !isProd, limit: isProd ? undefined : 1 })
  ├── step: fan-out-report-events
  │     └── step.sendEvent("fan-out-report-events", [
  │           ...one analytics/report.requested per client, all with
  │           reportPeriod: { preset: "last_week" }, scheduledAt: now
  │         ])
  └── returns { dispatched: N }

        │ (one run per client, fully isolated)
        ▼
send-weekly-analytics-report  (× N clients, parallel)
  ├── step: validate-ga4-config
  │     └── check clientId present; check client.ga4_property_id not null
  ├── step: fetch-client-config
  │     └── getClientById(clientId)
  ├── step: resolve-report-period
  │     └── resolve ReportPeriod preset → ResolvedPeriod (concrete dates + label)
  ├── step: fetch-analytics-data
  │     └── getAnalyticsReport(client.ga4_property_id, resolvedPeriod)
  │           ├── getReportData() — daily: sessions, activeUsers, newUsers
  │           ├── getAverageSessionDuration() — avg session duration
  │           ├── getTrafficSourceData(limit=5) — top sources
  │           └── getMostViewedPagesData(limit=5) — top pages
  ├── step: send-email
  │     └── sendEmail({ to: client.email, subject: "Your analytics report — {label}", html })
  └── step: log-result
        └── log clientId, preset, resolvedPeriod, mode, outcome, isMock
```
