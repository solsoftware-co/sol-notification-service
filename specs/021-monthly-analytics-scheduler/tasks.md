# Tasks: Monthly Analytics Report Scheduler

**Input**: Design documents from `/specs/021-monthly-analytics-scheduler/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Add the new event type that the scheduler and tests both depend on.

- [x] T001 Add `MonthlyScheduledPayload` interface (empty object) to `src/types/index.ts` — export alongside existing payload types

**Checkpoint**: Type is importable. No other changes needed — all other types (`AnalyticsReportRequestedPayload`, `ClientRow`) are reused unchanged.

---

## Phase 2: Foundational — Business-Day Utility

**Purpose**: Standalone, zero-dependency utility that all user stories depend on. Delivers weekend detection now; holiday detection added in Phase 4 to keep phases independently testable.

⚠️ **CRITICAL**: No scheduler implementation can begin until `isNonHolidayWeekday` is exported and working.

- [x] T002 Create `src/utils/business-days.ts` — export `toDateStr(d: Date): string` helper and `isNonHolidayWeekday(date: Date): boolean` (Phase 2 version: returns `false` for Saturday/Sunday, `true` otherwise; holiday check wired in T008)
- [x] T003 [P] Write `tests/unit/utils/business-days.test.ts` — cover: Monday–Friday → `true`; Saturday → `false`; Sunday → `false`; UTC date boundary correctness

**Checkpoint**: `isNonHolidayWeekday` correctly rejects weekends. Scheduler can now be built in Phase 3 and will handle US1 + US2 fully.

---

## Phase 3: User Story 1 + 2 — Core Scheduler with Weekend Skip (Priority: P1) 🎯 MVP

**Goal**: Automated monthly scheduler fires on the 2nd, checks if the date is a weekday, sleeps to the next day if not, and fans out `last_month` report events when a valid day is found.

**Independent Test**: Trigger the scheduler manually with a known Tuesday date (mock `capture-trigger-date`) — confirm `check-business-day-0` returns `true` and exactly one `analytics/report.requested` event per active client is dispatched with `preset: "last_month"`. Then mock a Saturday anchor — confirm `check-business-day-0` returns `false` and a `sleepUntil` step fires.

- [x] T004 [US1] [US2] Create `src/inngest/functions/monthly-analytics-scheduler.ts` — `inngest.createFunction` with `id: "monthly-analytics-scheduler"`, `retries: 2`, `concurrency: { limit: 1, scope: "fn" }`, triggers `[{ cron: "0 9 2 * *" }, { event: "analytics/monthly.scheduled" }]`; implement `capture-trigger-date` step (normalise `new Date()` to 9:00:00 UTC, return ISO string); implement bounded loop `for i = 0..6`: `check-business-day-${i}` step calls `isNonHolidayWeekday(candidate)` where `candidate = triggerDate + i days`; if false and `i < 6`, call `step.sleepUntil("sleep-until-day-${i+1}", nextDayAt9amUTC)`; if 7 days exhausted without a valid day, log skip and return `{ dispatched: 0, env: config.env, skipped: true }`
- [x] T005 [US1] [US2] Add `fetch-active-clients` step and `fan-out-report-events` step to `src/inngest/functions/monthly-analytics-scheduler.ts` — `fetch-active-clients` calls `getAllActiveClients({ testOnly: config.env !== "production", limit: config.env !== "production" ? 1 : undefined })`; `fan-out-report-events` maps each client to `{ name: "analytics/report.requested", data: { clientId, reportPeriod: { preset: "last_month" }, scheduledAt: targetDateStr } }` and calls `step.sendEvent`; return `{ dispatched: ids.length, env: config.env }`
- [x] T006 [US1] [US2] Export `monthlyAnalyticsScheduler` from `src/inngest/functions/index.ts` — add to the `functions` array alongside existing exports
- [x] T007 [P] [US1] [US2] Write `tests/unit/inngest/functions/monthly-analytics-scheduler.test.ts` — mock `config`, `db`, `logger` following `weekly-analytics-scheduler.test.ts` pattern; test cases: (a) weekday anchor → `check-business-day-0` returns `true`, no sleep, events dispatched with `preset: "last_month"` and string `scheduledAt`; (b) 3 active clients → 3 events dispatched; (c) 0 clients → `dispatched: 0`; (d) non-production → `getAllActiveClients` called with `testOnly: true, limit: 1`; (e) Saturday anchor → `check-business-day-0` returns `false` (use `executeStep` to verify step output)

**Checkpoint**: US1 + US2 fully functional. Scheduler handles weekday hits and weekend deferrals. Non-prod safety active. All P1 tests passing.

---

## Phase 4: User Story 3 — Federal Holiday Enforcement (Priority: P2)

**Goal**: `isNonHolidayWeekday` returns `false` on any of the 11 US federal holidays (or their observed Monday/Friday equivalents), causing the scheduler loop to defer.

**Independent Test**: Call `isNonHolidayWeekday` directly with known holiday dates (e.g. 2026-01-01 Thursday, 2026-07-04 Saturday → observed Friday 2026-07-03) — confirm `false`. Call with the day after each holiday — confirm `true`.

- [x] T008 [US3] Extend `src/utils/business-days.ts` — add private helpers `nthWeekdayOfMonth(year, month, n, dow)`, `lastWeekdayOfMonth(year, month, dow)`, `observedDate(year, month, day)`; implement `getUSFederalHolidays(year: number): Set<string>` computing all 11 federal holidays with observed-date adjustment; update `isNonHolidayWeekday` to call `getUSFederalHolidays(date.getUTCFullYear())` and check membership
- [x] T009 [P] [US3] Extend `tests/unit/utils/business-days.test.ts` — add test cases for: all 11 holidays by name (known 2026 dates); Saturday→Friday observed (e.g. Jul 4 2026 = Saturday → observed Jul 3); Sunday→Monday observed (e.g. Jan 1 2023 = Sunday → observed Jan 2); day-after each holiday → `true`; 2027 and 2028 spot-checks for floating holidays (MLK Day, Memorial Day, Labor Day, Thanksgiving)

**Checkpoint**: US3 complete. `isNonHolidayWeekday` now fully enforces both weekend and holiday rules. The scheduler loop already calls this function — no changes needed there.

---

## Phase 5: User Story 4 — Manual Trigger Verification (Priority: P3)

**Goal**: Confirm the `analytics/monthly.scheduled` manual trigger applies identical business-day logic to the cron path — no bypass, no special casing.

**Independent Test**: Send `analytics/monthly.scheduled` with a Saturday anchor (mocked `capture-trigger-date`) — confirm behaviour is identical to cron path: `check-business-day-0` returns `false`, sleep step fires.

- [x] T010 [US4] Extend `tests/unit/inngest/functions/monthly-analytics-scheduler.test.ts` — add test case: trigger event `{ name: "analytics/monthly.scheduled", data: {} }` with Saturday anchor → `check-business-day-0` step returns `false`, confirming no special-case bypass for the manual path

**Checkpoint**: US4 verified. Manual and cron paths are provably identical in their business-day enforcement.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 Run `npm run type-check` from repo root — fix any TypeScript errors across `src/utils/business-days.ts`, `src/inngest/functions/monthly-analytics-scheduler.ts`, `src/types/index.ts`
- [x] T012 [P] Run `npm test` — confirm all test files pass (14+ existing + 2 new); no regressions in `weekly-analytics-scheduler`, `analytics-report`, or other suites

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS Phase 3
- **Phase 3 (US1+US2)**: Depends on Phase 2 — core scheduler implementation
- **Phase 4 (US3)**: Depends on Phase 2 — extends business-days utility; Phase 3 scheduler picks up holiday enforcement automatically (no scheduler changes needed)
- **Phase 5 (US4)**: Depends on Phase 3 — adds test coverage for manual trigger path
- **Phase 6 (Polish)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 + US2 (P1)**: Depend on Foundational (Phase 2); can be implemented together in Phase 3
- **US3 (P2)**: Depends only on Phase 2 (`business-days.ts` exists); the scheduler loop calls `isNonHolidayWeekday` already — adding holiday logic to the utility is sufficient
- **US4 (P3)**: Depends on Phase 3 (scheduler function exists to test)

### Parallel Opportunities

- T003 (business-days weekend tests) can run in parallel with any Phase 1 work
- T007 (scheduler unit tests) can be written in parallel with T004–T006 since mocks decouple it
- T009 (holiday unit tests) can be written in parallel with T008 (test-first if preferred)
- T011 and T012 can run in parallel with each other

---

## Parallel Example: Phase 3

```
After T002 (business-days.ts created):

  In parallel:
    T004 → implement scheduler loop skeleton
    T003 → write weekend unit tests (different file)

After T004:
  In parallel:
    T005 → add fan-out steps
    T007 → write scheduler tests (different file, mocks decouple)

T006 (register in index.ts) → after T004+T005
```

---

## Implementation Strategy

### MVP (US1 + US2 only — Phases 1–3)

1. T001 — add type
2. T002 — create business-days.ts (weekends only)
3. T004 → T005 → T006 — full scheduler function
4. **STOP and VALIDATE**: trigger `analytics/monthly.scheduled` in Inngest Dev UI on a known weekday and Saturday; confirm fan-out and sleep behaviour
5. Deploy — monthly reporting is live with weekend enforcement

### Incremental Delivery

1. Phases 1–3 → MVP shipped (US1 + US2)
2. Phase 4 → US3 adds holiday safety (extend existing utility, no scheduler changes)
3. Phase 5 → US4 adds test confidence for manual trigger path
4. Phase 6 → polish + full test suite confirmation

---

## Notes

- [P] tasks target different files — no conflicts when run in parallel
- US3 requires no changes to the scheduler function — `isNonHolidayWeekday` is the only edit surface
- The `step.sleepUntil` loop is deterministic because `capture-trigger-date` is cached by Inngest across replays; all candidate dates are computed as `anchor + i * 86400000ms`
- Non-production safety (testOnly + limit:1) mirrors the weekly scheduler — test via `config.env = "development"` mock in unit tests
