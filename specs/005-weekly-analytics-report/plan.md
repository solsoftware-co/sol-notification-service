# Implementation Plan: Weekly Analytics Report

**Branch**: `005-weekly-analytics-report` | **Date**: 2026-02-28 (revised) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/005-weekly-analytics-report/spec.md`

---

## Summary

Implement a weekly scheduled Inngest workflow that fetches GA4 website traffic data per client and emails an analytics summary each Tuesday morning. Uses a two-function fan-out architecture: a cron-triggered scheduler (Tuesday 09:00 UTC) dispatches one `analytics/report.requested` event per active client with a `reportPeriod` preset, and a per-client worker resolves the preset to concrete dates, validates GA4 configuration, runs four parallel GA4 queries, and sends the report via the existing email abstraction. Supports five report period presets (`last_week`, `last_month`, `last_30_days`, `last_90_days`, `custom`) so the per-client workflow is independently triggerable with any date range from the Dev UI. Requires a new `src/lib/analytics.ts` module (modelled on the existing GA4 query pattern), two new Inngest functions, one new DB helper, new TypeScript types, and a new `GA4_SERVICE_ACCOUNT_JSON` environment variable.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `inngest ^3.x` (existing), `@google-analytics/data ^4.x` (new — to install)
**Storage**: Neon PostgreSQL via `@neondatabase/serverless` — existing `clients` table, `ga4_property_id` column already present, no schema migration required
**Testing**: Vitest 2.x + `@inngest/test ^0.1.9` (existing patterns from 004)
**Target Platform**: Vercel (serverless) + Inngest cloud
**Performance Goals**: All active client reports delivered within 15 minutes of cron trigger (SC-001)
**Constraints**: GA4 credentials stored as env var (not file) for Vercel compatibility; non-production runs capped to 1 test client; all external calls wrapped in `step.run()` for retry safety
**Scale/Scope**: POC — up to ~10 active clients, Inngest free tier (50k runs/month)

---

## Constitution Check

*GATE: Must pass before implementation. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Event-Driven Workflow First | Both functions use `inngest.createFunction` + `step.run()` for every discrete operation. Fan-out uses `step.sendEvent()`. Event names follow `domain/action` convention. | PASS |
| II. Multi-Environment Safety | Scheduler applies test-client filter + 1-client limit in non-production. Email mode (mock/test/live) controlled by `EMAIL_MODE` env var. `GA4_SERVICE_ACCOUNT_JSON` absent in dev returns mock data safely. | PASS |
| III. Multi-Tenant by Design | `clientId` required in all event payloads. Client config fetched via `getClientById()`. Fan-out isolation: each client is an independent run. One client failure cannot block others. | PASS |
| IV. Observability by Default | All steps have descriptive human-readable names. `config.env`, `clientId`, `ga4_property_id`, resolved period, email outcome all logged. Failed runs are replayable from dashboard. | PASS |
| V. AI-Agent Friendly Codebase | Spec exists before implementation. Function structure follows canonical template. Event payload types in `src/types/index.ts`. This plan kept current. | PASS |
| VI. Minimal Infrastructure | `@google-analytics/data` is already in the approved tech stack (constitution §Technology Stack). No Docker, no new infrastructure. Setup remains `npm run dev`. | PASS |

**Complexity Tracking**: No constitution violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-weekly-analytics-report/
├── plan.md              # This file
├── research.md          # Phase 0 complete
├── data-model.md        # Phase 1 complete
├── quickstart.md        # Phase 1 complete
├── contracts/
│   └── event-contract.md  # Phase 1 complete
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes

```text
src/
├── types/
│   └── index.ts              # ADD: ReportPeriodPreset, ReportPeriod, ResolvedPeriod,
│                             #      AnalyticsReportRequestedPayload, TopPage, TrafficSource,
│                             #      DailyMetric, AnalyticsReport
│                             # UPDATE: AppConfig (add ga4CredentialsJson field)
├── lib/
│   ├── config.ts             # UPDATE: read GA4_SERVICE_ACCOUNT_JSON, add to AppConfig
│   ├── db.ts                 # ADD: getAllActiveClients() helper
│   └── analytics.ts          # NEW: GA4 Data API wrapper (getAnalyticsReport + internal helpers)
└── inngest/
    └── functions/
        ├── index.ts                      # UPDATE: register 2 new functions
        ├── weekly-analytics-scheduler.ts # NEW: cron fan-out function (Tuesday 09:00 UTC)
        └── weekly-analytics-report.ts    # NEW: per-client report function

tests/
└── unit/
    ├── lib/
    │   └── analytics.test.ts                    # NEW
    └── inngest/
        ├── weekly-analytics-scheduler.test.ts   # NEW
        └── weekly-analytics-report.test.ts      # NEW

scripts/
└── seed-data.ts    # UPDATE: ensure test client has ga4_property_id set
```

---

## Implementation Phases

### Phase 1: Types & Config

**Goal**: All new TypeScript types and the new config field are in place before any implementation files reference them.

**Files**:

1. **`src/types/index.ts`** — Add:
   - `ReportPeriodPreset` union type: `"last_week" | "last_month" | "last_30_days" | "last_90_days" | "custom"`
   - `ReportPeriod` interface: `{ preset: ReportPeriodPreset; start?: string; end?: string }`
   - `ResolvedPeriod` interface: `{ start: string; end: string; label: string; preset: ReportPeriodPreset }`
   - `AnalyticsReportRequestedPayload` interface (extends `BaseEventPayload`, adds `reportPeriod: ReportPeriod`, `scheduledAt: string`)
   - `TopPage` interface: `{ path: string; views: number }`
   - `TrafficSource` interface: `{ source: string; sessions: number }`
   - `DailyMetric` interface: `{ date: string; sessions: number; activeUsers: number; newUsers: number }`
   - `AnalyticsReport` interface: `{ sessions, activeUsers, newUsers, avgSessionDurationSecs, topPages, topSources, dailyMetrics, resolvedPeriod, isMock }`
   - `ga4CredentialsJson: string | null` field added to `AppConfig`

2. **`src/lib/config.ts`** — Add:
   - Read `GA4_SERVICE_ACCOUNT_JSON` from `process.env` into `ga4CredentialsJson`
   - In `buildConfig()`: if `env === "production"` and `ga4CredentialsJson` is null, throw `"GA4_SERVICE_ACCOUNT_JSON environment variable is required in production"`
   - Return `ga4CredentialsJson` in the config object

**Constitution gates**: Config reads exclusively from `src/lib/config.ts`. Startup throws with descriptive error if required vars missing in production.

---

### Phase 2: DB Helper

**Goal**: Add `getAllActiveClients()` to `src/lib/db.ts` following existing query patterns.

**Files**:

1. **`src/lib/db.ts`** — Add:
   ```typescript
   export async function getAllActiveClients(options?: {
     testOnly?: boolean;
     limit?: number;
   }): Promise<ClientRow[]>
   ```
   - Selects the same columns as `getClientById()`: `id, name, email, ga4_property_id, active, settings, created_at`
   - Base filter: `WHERE active = TRUE`
   - `testOnly: true`: adds `AND email LIKE '%test%'`
   - `limit`: adds `LIMIT $n` as a parameterized value
   - Returns empty array (not an error) when no clients match

**Constitution gates**: All DB queries route through `src/lib/db.ts`. Never call Neon/pg directly in function files.

---

### Phase 3: Analytics Module

**Goal**: GA4 Data API wrapper that operates in both mock and live modes, running four parallel queries to produce a rich `AnalyticsReport`.

**Files**:

1. **`src/lib/analytics.ts`** — Create:
   - Install `@google-analytics/data` as a production dependency
   - Instantiate `BetaAnalyticsDataClient` with `credentials: JSON.parse(config.ga4CredentialsJson)` — instantiation is lazy (only when live mode needed), not at module load
   - Internal private `runReport(args: RunReportArgs)` helper (mirrors existing pattern — typed wrapper around `analyticsDataClient.runReport`)
   - Four internal query functions:
     - `getReportData(propertyId, start, end)` — sessions, activeUsers, newUsers by date (daily trend)
     - `getAverageSessionDuration(propertyId, start, end)` — averageSessionDuration (aggregate)
     - `getTrafficSourceData(propertyId, start, end, limit=5)` — sessions by sessionSource, desc
     - `getMostViewedPagesData(propertyId, start, end, limit=5)` — screenPageViews by pagePath, desc
   - Exported `getAnalyticsReport(propertyId: string, period: ResolvedPeriod): Promise<AnalyticsReport>`
     - **Mock mode** (when `config.ga4CredentialsJson` is null): logs warning, returns hardcoded mock data with `isMock: true`
     - **Live mode**: runs all four queries in parallel via `Promise.all()`, parses and merges results into `AnalyticsReport`
     - Empty `rows` (zero-traffic period) → defaults to 0 / `[]`
     - All GA4 API errors propagate as-is so Inngest retries the step automatically
   - GA4 property format: prefix the stored numeric `propertyId` with `"properties/"` inside the module

**Constitution gates**: No GA4 SDK calls outside `src/lib/analytics.ts`.

---

### Phase 4: Scheduler Function

**Goal**: Cron-triggered function (Tuesday 09:00 UTC) that fetches active clients and fans out per-client report events with `preset: "last_week"`.

**Files**:

1. **`src/inngest/functions/weekly-analytics-scheduler.ts`** — Create:
   ```
   Function ID:  "weekly-analytics-scheduler"
   Triggers:     { cron: "0 9 * * 2" }  — Tuesday 09:00 UTC
                 { event: "analytics/weekly.scheduled" }  — manual Dev UI trigger
   Retries:      2
   Concurrency:  { limit: 1, scope: "fn" }  — prevents overlapping cron runs
   ```

   Steps (in order):
   - `"fetch-active-clients"`: Call `getAllActiveClients({ testOnly: config.env !== "production", limit: config.env !== "production" ? 1 : undefined })`
   - `"fan-out-report-events"`:
     - Compute `scheduledAt = new Date().toISOString()`
     - Build one `analytics/report.requested` event per client: `{ name, data: { clientId, reportPeriod: { preset: "last_week" }, scheduledAt } }`
     - If zero events: log warning and return `{ dispatched: 0 }`
     - Call `step.sendEvent("fan-out-report-events", events)`
   - Return `{ dispatched: ids.length, env: config.env }`

   **`last_week` period note**: The scheduler does NOT compute the dates — it sends the preset. The worker resolves dates using `scheduledAt`. This lets the worker be triggered directly with any preset.

2. **`src/inngest/functions/index.ts`** — Register the new function

**Constitution gates**: `step.sendEvent()` not `inngest.send()`. Step names human-readable. `config.env` logged at start.

---

### Phase 5: Per-Client Report Function

**Goal**: Event-triggered function that resolves the period, validates GA4 config, fetches analytics, and sends the report email.

**Files**:

1. **`src/inngest/functions/weekly-analytics-report.ts`** — Create:
   ```
   Function ID:  "send-weekly-analytics-report"
   Trigger:      { event: "analytics/report.requested" }
   Retries:      3
   ```

   Steps (in order):
   - **`"validate-payload"`**: Check `data.clientId` is present and non-empty — throw `"Missing required field: clientId"` if absent
   - **`"fetch-client-config"`**: Call `getClientById(clientId)`. Then check `client.ga4_property_id` — if null, throw `"GA4 property not configured: {clientId}"`
   - **`"resolve-report-period"`**: Resolve `data.reportPeriod` preset → `ResolvedPeriod` using `data.scheduledAt` as reference:
     - `last_week`: `start = scheduledAt - 8 days` (Monday), `end = scheduledAt - 2 days` (Sunday)
     - `last_month`: first day of previous calendar month → last day of previous calendar month
     - `last_30_days`: `yesterday - 29 days` → `yesterday`
     - `last_90_days`: `yesterday - 89 days` → `yesterday`
     - `custom`: validate `start` and `end` both present, use verbatim — throw if either missing
     - Unknown preset: throw `"Unknown report period preset: {preset}"`
     - All dates formatted as `"YYYY-MM-DD"` strings. `label` formatted as `"MMM D – MMM D, YYYY"`
   - **`"fetch-analytics-data"`**: Call `getAnalyticsReport(client.ga4_property_id, resolvedPeriod)`
   - **`"send-email"`**: Build HTML email from `AnalyticsReport`. Sections: summary stats card (sessions, active users, new users, avg duration), top traffic sources table (top 5), top pages table (top 5), daily trend (text list). Subject: `"Your analytics report — {resolvedPeriod.label}"`. Call `sendEmail({ to: client.email, subject, html })`
   - **`"log-result"`**: Log `clientId`, `preset`, `resolvedPeriod`, `mode`, `outcome`, `originalTo`, `isMock`
   - Return `{ clientId, preset: data.reportPeriod.preset, resolvedPeriod, outcome, isMock }`

2. **`src/inngest/functions/index.ts`** — Register this function

**Constitution gates**: All steps descriptive. Email via `sendEmail()`. Client config via `getClientById()`. `clientId` in all error paths.

---

### Phase 6: Tests

**Goal**: Match 003/004 coverage depth for both new functions and the analytics module.

**Files**:

1. **`tests/unit/lib/analytics.test.ts`** — New:
   - Mock `config` (same hoisted `vi.mock` pattern as existing tests)
   - Mock `@google-analytics/data` `BetaAnalyticsDataClient`
   - Test: mock mode (no credentials) → returns `AnalyticsReport` with `isMock: true`, no SDK calls
   - Test: live mode → `Promise.all` calls all four `runReport()` variants, parsed correctly
   - Test: zero-traffic response (empty `rows`) → all counts 0, lists empty
   - Test: GA4 API error propagates (not swallowed, so Inngest can retry)

2. **`tests/unit/inngest/weekly-analytics-scheduler.test.ts`** — New (`@inngest/test` patterns):
   - Mock `getAllActiveClients`, `config`
   - Test: non-production, 2 clients → exactly 1 `analytics/report.requested` event dispatched
   - Test: production, 3 clients → 3 events dispatched
   - Test: 0 active clients → 0 events, function completes successfully
   - Test: dispatched event payload contains `reportPeriod: { preset: "last_week" }` and `scheduledAt`

3. **`tests/unit/inngest/weekly-analytics-report.test.ts`** — New:
   - Mock `getClientById`, `getAnalyticsReport`, `sendEmail`, `config`
   - Test: happy path `last_week` — all 6 steps execute, email sent to client
   - Test: missing `clientId` → `validate-payload` throws, no further steps run
   - Test: client not found → `fetch-client-config` throws "Client not found"
   - Test: `ga4_property_id` is null → `fetch-client-config` throws "GA4 property not configured"
   - Test: `custom` preset with valid dates → `resolve-report-period` returns correct dates
   - Test: `custom` preset missing `end` → `resolve-report-period` throws
   - Test: unknown preset → `resolve-report-period` throws
   - Test: `last_month` preset → resolved start is first of last month, end is last of last month
   - Test: GA4 API error → `fetch-analytics-data` throws, propagates for Inngest retry
   - Test: `isMock: true` in analytics report → email still sent, outcome logged

---

### Phase 7: Seed Update & CLAUDE.md

**Goal**: Local development tooling reflects this feature.

1. **`scripts/seed-data.ts`** — Ensure at least one test client seeded with non-null `ga4_property_id` (placeholder `"123456789"`)

2. **`CLAUDE.md`** — Update:
   - Add `@google-analytics/data ^4.x` to Active Technologies
   - Add `src/lib/analytics.ts` to Project Structure with description
   - Note `GA4_SERVICE_ACCOUNT_JSON` env var
   - Add the two new function files under `src/inngest/functions/`

---

## Dependency Graph

```
Phase 1 (Types + Config)
  ├── Phase 2 (DB Helper)          ← can run in parallel with Phase 3
  └── Phase 3 (Analytics Module)   ← can run in parallel with Phase 2
        ├── Phase 4 (Scheduler Function)    ← can run in parallel with Phase 5
        └── Phase 5 (Per-Client Function)   ← can run in parallel with Phase 4
              └── Phase 6 (Tests)
                    └── Phase 7 (Seed + CLAUDE.md)
```

---

## Implementation Notes

- **GA4 property ID format**: Column stores numeric ID only (e.g., `"123456789"`). `analytics.ts` prefixes with `"properties/"` internally. Do not store the prefix in the database.
- **BetaAnalyticsDataClient instantiation**: Create lazily inside `getAnalyticsReport()` (not at module load) to avoid startup errors when credentials are absent in dev.
- **Date arithmetic**: Use native JS `Date` objects — no external date library required. All dates formatted as `"YYYY-MM-DD"` via `toISOString().slice(0, 10)`. For `last_month` end date: use `new Date(year, month, 0)` (day 0 of current month = last day of previous month).
- **`last_week` reference**: `scheduledAt` is the cron fire time (Tuesday 09:00 UTC). Subtracting 2 days gives Sunday 09:00 UTC → use date only (ignore time). Subtracting 8 days gives Monday.
- **Dual trigger (`cron` + `event`)**: Inngest v3 supports an array of triggers `[{ cron }, { event }]`. If this does not work at runtime with `inngest ^3.0.0`, implement a thin wrapper function that listens to `analytics/weekly.scheduled` and internally calls the same step logic.
- **Mock `AnalyticsReport` values**: Use clearly synthetic data (e.g., `sessions: 42`, `activeUsers: 31`, `topPages: [{ path: "/", views: 120 }]`). `isMock: true` is logged in the step output but does not add a banner to the email body.
- **`avgSessionDurationSecs` formatting**: Convert raw seconds to `"Xm Ys"` string in the email builder, not in `analytics.ts` — keep the module data-only.
