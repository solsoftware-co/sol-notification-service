# Research: Weekly Analytics Report (005)

**Date**: 2026-02-28 (revised)
**Branch**: `005-weekly-analytics-report`

---

## Decision 1: Inngest Fan-Out Pattern

**Decision**: Use `step.sendEvent()` inside the cron function to dispatch one `analytics/report.requested` event per client.

**Rationale**: `step.sendEvent()` is the correct API for sending events from *inside* a function. It wraps the send in a durable, memoized step — if the scheduler function is retried after the fan-out already succeeded, the events will not be re-dispatched. Using `inngest.send()` directly inside a function loses this memoization guarantee.

**API signature**:
```typescript
step.sendEvent(
  id: string,                    // step name — used for memoization
  eventPayload: Event | Event[]  // single event or array (max 512 KB total)
): Promise<{ ids: string[] }>
```

**Cron trigger syntax** (Inngest v3):
```typescript
inngest.createFunction(
  { id: "weekly-analytics-scheduler", retries: 2 },
  { cron: "0 9 * * 2" },  // Tuesday 09:00 UTC
  async ({ step }) => { ... }
)
```

Note: Cron handlers do *not* receive a meaningful `event` argument — only `{ step }` should be destructured.

**Non-production throttle**: Use a code-level guard inside the fan-out step — filter clients by `email LIKE '%test%'` in the DB query and `LIMIT 1`. This is simpler and more readable than Inngest `throttle` or `rateLimit` primitives, which operate on function runs rather than on the number of events dispatched.

**Preventing overlapping cron runs**: Use `concurrency: { limit: 1, scope: "fn" }` in the scheduler function config. This queues a second cron invocation rather than running it in parallel, which protects against deployment restarts triggering a second run mid-execution.

**Idempotency**: Inngest guarantees at-least-once cron execution. `step.sendEvent()` memoization prevents duplicate fan-out on function retry. Duplicate cron fires (infrastructure edge case) would produce duplicate scheduler runs — acceptable for a weekly report at this POC scale.

**Alternatives considered**:
- `inngest.send()` inside a step — rejected; loses memoization, no retry safety
- Inngest `throttle` config — rejected; limits runs not event dispatch count
- Fetching all clients then looping `step.sendEvent()` per client — rejected; single batched `step.sendEvent()` call with an array is simpler and produces better dashboard grouping

---

## Decision 2: Two-Function Architecture

**Decision**: Implement as two separate Inngest functions — a scheduler (`weekly-analytics-scheduler`) and a per-client worker (`send-weekly-analytics-report`).

**Rationale**: This is the canonical fan-out pattern from the Inngest documentation and satisfies FR-009 (one client's failure must not block others). Each per-client function is an independent run with its own retry budget.

**Scheduler function**: Cron-triggered (`0 9 * * 2`, Tuesday). Fetches all active clients. Fans out `analytics/report.requested` per client with `reportPeriod: { preset: "last_week" }`.

**Worker function**: Event-triggered (`analytics/report.requested`). Resolves the period preset to concrete dates, validates GA4 config, fetches report data, sends email.

**Alternatives considered**:
- Single function with per-client loops — rejected; violates FR-009 fan-out isolation requirement and the constitution's multi-tenant principle
- `step.forEach()` (not available in Inngest v3) — n/a

---

## Decision 3: GA4 Data API Authentication

**Decision**: Store the service account JSON as a single environment variable (`GA4_SERVICE_ACCOUNT_JSON`) and parse it at runtime in `src/lib/analytics.ts`.

**Rationale**: Vercel is a serverless environment with no persistent file system. The standard `GOOGLE_APPLICATION_CREDENTIALS` approach requires a file path, which is incompatible. Passing the JSON directly to `BetaAnalyticsDataClient({ credentials: ... })` works identically to file-based auth and is deployment-agnostic.

**Implementation**:
```typescript
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: JSON.parse(config.ga4CredentialsJson!),
});
```

**Mock mode**: When `GA4_SERVICE_ACCOUNT_JSON` is absent (local development), `analytics.ts` returns a hardcoded mock report. In production, absent credentials cause config to throw on startup.

**Alternatives considered**:
- `GOOGLE_APPLICATION_CREDENTIALS` file path — rejected; incompatible with Vercel serverless
- Per-client GA4 credentials — rejected; per-client credential management is out of scope
- ADC (Application Default Credentials) — rejected; requires GCP Workload Identity or local `gcloud auth`

---

## Decision 4: GA4 Metrics & Query Structure

**Decision**: Use four separate `runReport()` calls (daily metrics, avg session duration, top traffic sources, top pages), all run in parallel via `Promise.all()`. Structure mirrors the existing `src/utils/ga4Reports.ts` implementation from a prior iteration of this product.

**Rationale**: Separate targeted queries are easier to parse, test, and reason about than combined cross-product queries. Running them in parallel minimises total GA4 API latency per client. The user's existing code confirms this pattern is proven and correct.

**Query inventory**:

```typescript
// 1. Daily trend: sessions, activeUsers, newUsers by date
runReport({
  property,
  dateRanges: [{ startDate, endDate }],
  metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
  dimensions: [{ name: "date" }],
  orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
})

// 2. Avg session duration (aggregate, no dimension)
runReport({
  property,
  dateRanges: [{ startDate, endDate }],
  metrics: [{ name: "averageSessionDuration" }],
})

// 3. Top traffic sources by sessions
runReport({
  property,
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: "sessionSource" }],
  metrics: [{ name: "sessions" }],
  orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  limit: 5,
})

// 4. Top pages by screenPageViews
runReport({
  property,
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: "pagePath" }],
  metrics: [{ name: "screenPageViews" }],
  orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
  limit: 5,
})
```

**Package**: `@google-analytics/data` (npm). Install as a production dependency. TypeScript types bundled. Uses `BetaAnalyticsDataClient` — the beta client matches the `protos.google.analytics.data.v1beta` types used in the existing codebase.

**Response parsing**: All metric/dimension values in the GA4 response are strings. Convert with `parseInt()` / `parseFloat()`. Empty `rows` array (zero-traffic period) → default all counts to 0, ranked lists to `[]`.

**Alternatives considered**:
- Single combined query — rejected; cross-product row structure increases parsing complexity
- GA4 Reporting API v4 (REST) — rejected; SDK handles auth/serialization and is already in approved stack

---

## Decision 5: `getAllActiveClients()` DB Helper

**Decision**: Add a new `getAllActiveClients()` function to `src/lib/db.ts` with optional `testOnly` and `limit` parameters.

**Rationale**: Scheduler needs to fetch all active clients in a single query. Exposing raw `query()` in the function file would violate the constitution's rule that all DB calls route through `src/lib/db.ts`.

**Signature**:
```typescript
export async function getAllActiveClients(options?: {
  testOnly?: boolean;  // adds AND email LIKE '%test%'
  limit?: number;      // adds LIMIT $n
}): Promise<ClientRow[]>
```

**Alternatives considered**:
- Raw `query()` call in the scheduler function — rejected; violates constitution
- Separate queries for prod vs. non-prod — rejected; single parameterized query is simpler

---

## Decision 6: Report Period Presets

**Decision**: Add a `ReportPeriod` type with a `preset` field supporting five values: `last_week`, `last_month`, `last_30_days`, `last_90_days`, and `custom`. The preset is resolved to concrete ISO dates inside the per-client workflow in a dedicated `"resolve-report-period"` step.

**Rationale**: The scheduler always sends `last_week` (matching the Tuesday cron semantics — Mon–Sun of the previous full calendar week). But the worker function is independently triggerable from the Dev UI with any preset, enabling ad-hoc monthly summaries or custom date ranges without code changes. Resolving in the worker (rather than the scheduler) means the resolution logic is close to the GA4 query and the resolved dates appear in the dashboard step output.

**`last_week` date arithmetic** (reference point: Tuesday 09:00 UTC):
- Yesterday = Monday
- Last Sunday = `scheduledAt - 2 days` (end of last full week)
- Last Monday = `scheduledAt - 8 days` (start of last full week)
- Result: covers the complete Mon–Sun calendar week that ended two days before the cron fires

**`last_month` date arithmetic**:
- Start: first day of the month prior to `scheduledAt`'s month
- End: last day of that prior month (handle varying month lengths including Feb)

**`custom` validation**: Both `start` and `end` must be present — the resolve step throws immediately if either is absent, before any GA4 call is made.

**Alternatives considered**:
- Resolving dates in the scheduler and sending concrete start/end — rejected; loses the ability to trigger the worker with non-default presets from the Dev UI
- GA4 native expressions ("7daysAgo", "yesterday") — rejected; doesn't work for calendar-aligned periods like `last_week` (Mon–Sun) or `last_month`, and doesn't produce a human-readable label for the email

---

## Resolved Unknowns

| Assumption | Resolution |
|------------|------------|
| `ga4_property_id` column needs migration | Already exists in `clients` table and `ClientRow` — no migration needed |
| GA4 credential strategy | `GA4_SERVICE_ACCOUNT_JSON` env var, parsed with JSON.parse() — Vercel-compatible |
| Cron day | Tuesday (`0 9 * * 2`), not Monday — ensures `last_week` covers a complete Mon–Sun calendar week |
| Reporting period for `last_week` | Mon 8 days ago → Sun 2 days ago (relative to Tuesday cron) |
| Flexible period support | `ReportPeriod` preset system: `last_week`, `last_month`, `last_30_days`, `last_90_days`, `custom` |
| GA4 query scope | 4 parallel queries: daily metrics, avg duration, top sources, top pages (pattern from existing codebase) |
| Mock mode for analytics in dev | Return hardcoded mock data when `GA4_SERVICE_ACCOUNT_JSON` absent — same pattern as email mock mode |
| Manual triggering from Dev UI | `analytics/weekly.scheduled` triggers scheduler; `analytics/report.requested` can be sent directly for any preset |
