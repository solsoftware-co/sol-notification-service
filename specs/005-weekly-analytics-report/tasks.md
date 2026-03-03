---
description: "Task list for 005-weekly-analytics-report"
---

# Tasks: Weekly Analytics Report

**Input**: Design documents from `/specs/005-weekly-analytics-report/`
**Branch**: `005-weekly-analytics-report`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story this task belongs to — US1, US2, US3 (from spec.md)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install the new production dependency before any code references it.

- [x] T001 Install `@google-analytics/data` as a production dependency (`npm install @google-analytics/data`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, config, and DB helper that every function and test depends on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete all T002–T006 before beginning Phase 3.

- [x] T002 Add all new analytics types to `src/types/index.ts`: `ReportPeriodPreset` union type, `ReportPeriod` interface, `ResolvedPeriod` interface, `TopPage` interface, `TrafficSource` interface, `DailyMetric` interface, `AnalyticsReport` interface (see data-model.md for full field definitions)
- [x] T003 Add `AnalyticsReportRequestedPayload` interface to `src/types/index.ts` (extends `BaseEventPayload`, adds `reportPeriod: ReportPeriod` and `scheduledAt: string`) and add `ga4CredentialsJson: string | null` field to the existing `AppConfig` interface (depends on T002 — same file)
- [x] T004 Update `src/lib/config.ts` in `buildConfig()`: read `GA4_SERVICE_ACCOUNT_JSON` from `process.env` into `ga4CredentialsJson`; add production guard that throws `"GA4_SERVICE_ACCOUNT_JSON environment variable is required in production"` when `env === "production"` and value is null; return `ga4CredentialsJson` in the config object
- [x] T005 Add `getAllActiveClients(options?: { testOnly?: boolean; limit?: number }): Promise<ClientRow[]>` to `src/lib/db.ts` — base query `SELECT id, name, email, ga4_property_id, active, settings, created_at FROM clients WHERE active = TRUE`, conditionally appending `AND email LIKE '%test%'` for `testOnly` and `LIMIT $n` for `limit`; returns empty array (not an error) when no rows match
- [x] T006 Add `GA4_SERVICE_ACCOUNT_JSON` test cases to `tests/unit/lib/config.test.ts` using the existing `vi.resetModules()` + dynamic import pattern: (a) absent in development → `ga4CredentialsJson` is null, no throw; (b) absent in production (`VERCEL_ENV=production`, `RESEND_API_KEY` set) → throws with message containing "GA4_SERVICE_ACCOUNT_JSON"; (c) present → returned as `ga4CredentialsJson` string on config object

**Checkpoint**: Foundation complete — Phase 3 user story work can now begin.

---

## Phase 3: User Story 1 — Client Receives Weekly Traffic Summary (Priority: P1) 🎯 MVP

**Goal**: Every Tuesday at 09:00 UTC, a cron fires, fans out one `analytics/report.requested` event per active client, and each client receives an analytics report email containing sessions, active users, new users, avg session duration, top 5 traffic sources, top 5 pages, and a daily metrics breakdown for the previous Mon–Sun calendar week.

**Independent Test**: With `npm run dev` running, send `analytics/weekly.scheduled` from the Inngest Dev UI. In mock mode (no `GA4_SERVICE_ACCOUNT_JSON`), verify the scheduler run shows `fetch-active-clients` and `fan-out-report-events` steps, and the per-client `send-weekly-analytics-report` run shows all 6 steps completing with the mock analytics email logged to the console.

### Implementation

- [x] T007 [P] Create `src/lib/analytics.ts`: (a) private `runReport(args: RunReportArgs)` helper that wraps `BetaAnalyticsDataClient.runReport()` with typed args (propertyId, startDate, endDate, dimensions, metrics, orderBys, limit); (b) four named internal query functions — `getReportData` (sessions/activeUsers/newUsers by date, ordered by date asc), `getAverageSessionDuration` (averageSessionDuration aggregate), `getTrafficSourceData` (sessions by sessionSource desc, limit 5), `getMostViewedPagesData` (screenPageViews by pagePath desc, limit 5); (c) exported `getAnalyticsReport(propertyId: string, period: ResolvedPeriod): Promise<AnalyticsReport>` — in mock mode (when `config.ga4CredentialsJson` is null) logs warning and returns hardcoded mock data with `isMock: true`; in live mode instantiates `BetaAnalyticsDataClient({ credentials: JSON.parse(config.ga4CredentialsJson) })` lazily, runs all 4 queries via `Promise.all()`, parses string metric values with `parseInt()`/`parseFloat()`, defaults empty `rows` to 0/`[]`, prefixes `propertyId` with `"properties/"` internally
- [x] T008 Create `src/inngest/functions/weekly-analytics-scheduler.ts`: function ID `"weekly-analytics-scheduler"`, triggers `[{ cron: "0 9 * * 2" }, { event: "analytics/weekly.scheduled" }]`, retries 2, concurrency `{ limit: 1, scope: "fn" }`; step `"fetch-active-clients"` calls `getAllActiveClients({ testOnly: config.env !== "production", limit: config.env !== "production" ? 1 : undefined })`; step `"fan-out-report-events"` computes `scheduledAt = new Date().toISOString()`, builds one `analytics/report.requested` event per client with `{ clientId, reportPeriod: { preset: "last_week" }, scheduledAt }`, calls `step.sendEvent("fan-out-report-events", events)`, returns early with `{ dispatched: 0 }` and logged warning if events array is empty; logs `config.env` and dispatched count; returns `{ dispatched: ids.length, env: config.env }` (depends on T005)
- [x] T009 Create `src/inngest/functions/weekly-analytics-report.ts`: function ID `"send-weekly-analytics-report"`, trigger `{ event: "analytics/report.requested" }`, retries 3; implement 6 steps in order — (1) `"validate-payload"`: check `data.clientId` present, throw `"Missing required field: clientId"` if absent; (2) `"fetch-client-config"`: call `getClientById(clientId)`, then check `client.ga4_property_id` — throw `"GA4 property not configured: ${clientId}"` if null; (3) `"resolve-report-period"`: resolve `data.reportPeriod` preset using `data.scheduledAt` as reference — `last_week` → start=scheduledAt-8days (Monday), end=scheduledAt-2days (Sunday); `last_month` → first/last day of previous calendar month; `last_30_days` → yesterday-29 to yesterday; `last_90_days` → yesterday-89 to yesterday; `custom` → validate both `start` and `end` present else throw, use verbatim; unknown preset → throw `"Unknown report period preset: ${preset}"`; all dates formatted `"YYYY-MM-DD"` via `toISOString().slice(0,10)`, label formatted as `"MMM D – MMM D, YYYY"`; (4) `"fetch-analytics-data"`: call `getAnalyticsReport(client.ga4_property_id, resolvedPeriod)`; (5) `"send-email"`: build HTML email with summary stats card (sessions/activeUsers/newUsers/avgSessionDuration formatted as "Xm Ys"), top traffic sources table, top pages table, and daily metrics list; subject `"Your analytics report — ${resolvedPeriod.label}"`; call `sendEmail({ to: client.email, subject, html })`; (6) `"log-result"`: log `clientId, preset, resolvedPeriod, mode, outcome, originalTo, isMock`; return `{ clientId, preset: data.reportPeriod.preset, resolvedPeriod, outcome, isMock }` (depends on T007)
- [x] T010 Register both new functions in `src/inngest/functions/index.ts` — import `weeklyAnalyticsScheduler` from `./weekly-analytics-scheduler` and `sendWeeklyAnalyticsReport` from `./weekly-analytics-report`; add both to the `functions` array export (depends on T008, T009)
- [x] T011 Update `scripts/seed-data.ts` to ensure at least one test client is seeded with `ga4_property_id: "123456789"` — use upsert or conditional insert so the script remains idempotent

### Tests (happy path)

- [x] T012 [P] [US1] Create `tests/unit/lib/analytics.test.ts`: mock `config` (hoisted `vi.mock` with `ga4CredentialsJson: null`) and `@google-analytics/data` `BetaAnalyticsDataClient`; test (a) mock mode — `getAnalyticsReport()` returns `AnalyticsReport` with `isMock: true`, SDK never instantiated, no `runReport` calls; test (b) live mode (`ga4CredentialsJson: '{"type":"service_account"}'`) — `getAnalyticsReport()` calls all 4 `runReport` variants, parses string metric values to numbers, returns correct `AnalyticsReport` shape; test (c) zero-traffic — all `rows` arrays empty → all counts 0, `topPages: []`, `topSources: []`, `dailyMetrics: []`
- [x] T013 [P] [US1] Create `tests/unit/inngest/functions/weekly-analytics-scheduler.test.ts`: mock `config` (env: "production"), `getAllActiveClients`, `logger`; test (a) production with 3 active clients → `step.sendEvent` called with array of 3 events, each containing `reportPeriod: { preset: "last_week" }` and a string `scheduledAt`; test (b) dispatched event data contains correct `clientId` for each client
- [x] T014 [P] [US1] Create `tests/unit/inngest/functions/weekly-analytics-report.test.ts`: mock `config`, `getClientById`, `getAnalyticsReport` (from `analytics.ts`), `sendEmail`, `logger`; test happy path with `last_week` preset — all 6 steps complete, `sendEmail` called with `to: client.email` and subject containing `resolvedPeriod.label`; test `last_week` date resolution — with `scheduledAt: "2026-02-24T09:00:00.000Z"` (Tuesday), resolved `start` = `"2026-02-16"` (Monday 8 days prior), `end` = `"2026-02-22"` (Sunday 2 days prior)

**Checkpoint**: US1 fully functional — send `analytics/weekly.scheduled` from Dev UI and verify end-to-end in mock mode.

---

## Phase 4: User Story 2 — One Client's Failure Does Not Block Others (Priority: P2)

**Goal**: Every failure path in the per-client worker produces a clear, diagnosable error in the Inngest dashboard — missing payload fields, unconfigured GA4, unknown presets, API errors — and zero emails are sent for the failing client. Scheduler completes cleanly when there are no active clients.

**Independent Test**: Send `analytics/report.requested` with a `clientId` that has no `ga4_property_id`. Verify the run fails at the `fetch-client-config` step with "GA4 property not configured" and no email is sent. Then send a valid event for another client and verify it succeeds independently.

### Tests (failure paths)

- [x] T015 [P] [US2] Add failure path test cases to `tests/unit/inngest/functions/weekly-analytics-report.test.ts`: (a) missing `clientId` → `validate-payload` step throws, `getClientById` never called; (b) client not found (`getClientById` throws "Client not found") → `fetch-client-config` step throws, `getAnalyticsReport` never called; (c) `ga4_property_id` is `null` on client → `fetch-client-config` step throws error containing "GA4 property not configured" and the `clientId`; (d) unknown `preset` value → `resolve-report-period` step throws containing "Unknown report period preset"; (e) `custom` preset with missing `end` field → `resolve-report-period` step throws; (f) `getAnalyticsReport` throws (GA4 API error) → `fetch-analytics-data` step throws and propagates (not swallowed) — `sendEmail` never called
- [x] T016 [P] [US2] Add zero-client and inactive-client test cases to `tests/unit/inngest/functions/weekly-analytics-scheduler.test.ts`: (a) `getAllActiveClients` returns empty array → `step.sendEvent` not called, function returns `{ dispatched: 0 }` without throwing; (b) verify `getAllActiveClients` is called (not raw `query`) — inactive client exclusion is handled inside `getAllActiveClients`, not in the function itself
- [x] T017 [P] [US2] Add GA4 error propagation test to `tests/unit/lib/analytics.test.ts`: in live mode, when `BetaAnalyticsDataClient.runReport()` throws, `getAnalyticsReport()` propagates the error rather than catching and returning a default — ensures Inngest sees the failure and retries the step

**Checkpoint**: US2 verified — all failure paths produce diagnosable dashboard errors with no silent swallowing.

---

## Phase 5: User Story 3 — Non-Production Runs Are Safe and Rate-Limited (Priority: P3)

**Goal**: In any non-production environment, the scheduler only fans out to test clients (email contains "test") and dispatches at most 1 event per cron run, regardless of how many active clients exist. All period presets resolve correctly. Production behaviour is unaffected.

**Independent Test**: With `EMAIL_MODE=test` and `VERCEL_ENV=preview`, send `analytics/weekly.scheduled`. Verify only 1 event is dispatched (to the test client), not to any real client. Verify the redirected test email is delivered to `TEST_EMAIL`.

### Tests (non-production safety + period preset coverage)

- [x] T018 [P] [US3] Add environment filter test cases to `tests/unit/inngest/functions/weekly-analytics-scheduler.test.ts`: (a) non-production (`env: "development"`) with 3 active clients → `getAllActiveClients` called with `{ testOnly: true, limit: 1 }` → exactly 1 `analytics/report.requested` event dispatched; (b) production (`env: "production"`) with 3 active clients → `getAllActiveClients` called with `{}` (no testOnly, no limit) → 3 events dispatched
- [x] T019 [P] [US3] Add period preset resolution test cases to `tests/unit/inngest/functions/weekly-analytics-report.test.ts`: (a) `last_month` with `scheduledAt: "2026-02-24T09:00:00.000Z"` → resolved start = `"2026-01-01"`, end = `"2026-01-31"`; (b) `last_30_days` with same `scheduledAt` → resolved start = 29 days before yesterday, end = yesterday (`"2026-02-23"`); (c) `custom` with valid `start: "2026-01-01"` and `end: "2026-01-15"` → resolved start/end match verbatim; (d) `custom` missing `start` field → `resolve-report-period` step throws

**Checkpoint**: All three user stories verified. Full feature is testable end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation to ensure the feature is discoverable and correctly described for future agents and developers.

- [x] T020 Update `CLAUDE.md`: (a) add `@google-analytics/data ^4.x` to Active Technologies section; (b) add `src/lib/analytics.ts` to Project Structure with description "GA4 Data API wrapper — getAnalyticsReport(), mock/live routing"; (c) add `weekly-analytics-scheduler.ts` and `weekly-analytics-report.ts` under `src/inngest/functions/`; (d) note `GA4_SERVICE_ACCOUNT_JSON` env var in any relevant env var documentation
- [ ] T021 Run quickstart.md validation: `npm run dev`, open Inngest Dev UI at `http://localhost:8288`, send `analytics/weekly.scheduled` event with empty payload `{}`, verify scheduler run shows `fetch-active-clients` and `fan-out-report-events` steps, verify `send-weekly-analytics-report` per-client run shows all 6 steps completing, verify mock analytics email logged to console containing "mock" isMock flag in step output; also send `analytics/report.requested` directly with `{ "clientId": "...", "reportPeriod": { "preset": "last_30_days" }, "scheduledAt": "..." }` and verify the `resolve-report-period` step output shows the correct concrete date range

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup — T001)
  └── Phase 2 (Foundational — T002–T006)  ← BLOCKS all user stories
        ├── Phase 3 (US1 — T007–T014)     ← Can begin after Phase 2
        │     └── Phase 4 (US2 — T015–T017) ← Can begin after T009 (worker implementation)
        │           └── Phase 5 (US3 — T018–T019) ← Can begin after T009
        └── Phase 6 (Polish — T020–T021)  ← After all stories complete
```

### Within Phase 2

- T002 → T003 (same file, sequential)
- T004 independent of T002/T003 (different file) — can run in parallel with T003
- T005 independent (different file) — can run in parallel after T002
- T006 depends on T004 (tests for the config changes)

### Within Phase 3

- T007 (analytics.ts) can start immediately after Phase 2
- T008 (scheduler) depends on T005 (getAllActiveClients)
- T009 (worker) depends on T007 (getAnalyticsReport)
- T010 (barrel) depends on T008 and T009
- T011 (seed) independent — can run any time after Phase 1
- T012 (analytics tests) depends on T007
- T013 (scheduler tests) depends on T008
- T014 (worker tests) depends on T009

### Within Phase 4 (US2)

- T015, T016, T017 all depend on their respective implementation tasks from Phase 3
- T015 and T016 and T017 are independent of each other — all marked [P]

### Within Phase 5 (US3)

- T018 depends on T008 (scheduler) and T013 (scheduler test file already created)
- T019 depends on T009 (worker) and T014 (worker test file already created)

### Parallel Opportunities

```bash
# Phase 2: After T002/T003, run in parallel:
Task T004  # config.ts update
Task T005  # db.ts helper

# Phase 3: After Phase 2, run in parallel:
Task T007  # analytics.ts (unblocked)
Task T008  # scheduler (unblocked after T005)
Task T011  # seed-data.ts (fully independent)

# Phase 3 tests: After T007/T008/T009, run in parallel:
Task T012  # analytics.test.ts
Task T013  # scheduler.test.ts
Task T014  # weekly-analytics-report.test.ts

# Phase 4: All three can run in parallel:
Task T015  # worker failure tests
Task T016  # scheduler zero-client tests
Task T017  # analytics error propagation test

# Phase 5: Both can run in parallel:
Task T018  # scheduler env filter tests
Task T019  # worker preset resolution tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T006)
3. Complete Phase 3: US1 (T007–T014)
4. **STOP and VALIDATE**: Run `npm test`, send `analytics/weekly.scheduled` from Dev UI, confirm mock analytics email logged
5. Demo: scheduler + per-client worker running end-to-end in mock mode

### Incremental Delivery

1. **Foundation** (Phase 1+2) → types + config + DB helper ready
2. **US1** (Phase 3) → weekly analytics emails working in all 3 modes (mock/test/live) → MVP!
3. **US2** (Phase 4) → failure paths verified and diagnosable from dashboard
4. **US3** (Phase 5) → non-production safety guaranteed, all presets tested
5. **Polish** (Phase 6) → docs current, quickstart validated

---

## Notes

- **21 tasks total**: 1 setup, 5 foundational, 14 across 3 user stories, 2 polish
- **[P] tasks**: T004, T005, T007, T012, T013, T014, T015, T016, T017, T018, T019
- Each user story phase is independently testable before moving to the next
- Config mock in test files MUST include `ga4CredentialsJson: null` alongside all existing fields (see existing `form-notification.test.ts` for the pattern)
- `BetaAnalyticsDataClient` must be instantiated lazily inside `getAnalyticsReport()`, not at module load — prevents startup errors when credentials are absent in dev
- Test file paths follow the existing convention: `tests/unit/inngest/functions/` (not `tests/unit/inngest/`)
- All dates formatted as `"YYYY-MM-DD"` via `.toISOString().slice(0, 10)` — no external date library needed
