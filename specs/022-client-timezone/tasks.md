# Tasks: Per-Client Timezone for 9 AM Local Delivery

**Input**: Design documents from `/specs/022-client-timezone/`
**Prerequisites**: plan.md ✓, spec.md ✓, data-model.md ✓, research.md ✓, contracts/ ✓

**Organization**: Tasks are grouped by user story. US1 + US2 are both P1 and tightly coupled (send-time and business-day logic live in the same worker steps), so they share a phase. US3 (timezone validation + DB column) is foundational and must land first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (No blocking work — project already initialized)

**Purpose**: Create the DB migration and verify branch state

- [X] T001 Create `db/migrations/V004__add_client_timezone.sql` — `ALTER TABLE clients ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Chicago'`

---

## Phase 2: Foundational — Types & Timezone Utility

**Purpose**: Types and utility that ALL user story phases depend on. Must complete before US1/US2/US3 implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add `SUPPORTED_TIMEZONES` const and `SupportedTimezone` type to `src/types/index.ts`
- [X] T003 Add `timezone: SupportedTimezone` field (default `"America/Chicago"`) to `ClientRow` interface in `src/types/index.ts`
- [X] T004 Create `src/utils/timezone.ts` — export `localDateStr(tz, date?)`, `next9amInTimezone(tz, from?)`, `isNonHolidayWeekdayInTz(date, tz)` using `Intl.DateTimeFormat` (no new packages)
- [X] T005 Create `tests/unit/utils/timezone.test.ts` — unit tests for all three exported functions: `localDateStr` (date string format, timezone accuracy), `next9amInTimezone` (each of 4 timezones, DST winter/summer, already-past-9am case), `isNonHolidayWeekdayInTz` (weekday in one tz / weekend in another, holiday delegation to `isNonHolidayWeekday`)

**Checkpoint**: `npm run type-check` passes; `npm test -- timezone` passes

---

## Phase 3: User Story 1 + 2 — 9 AM Local Delivery with Timezone-Aware Business-Day Check (Priority: P1) 🎯 MVP

**Goal**: Each analytics-report worker resolves the correct 9 AM UTC send time in the client's timezone, checks the business day in that local date, defers if needed, and sleeps until the exact send moment.

**Independent Test**: Trigger `analytics/report.requested` with a test client set to each of ET/CT/MT/PT. Confirm the `resolve-send-time` step returns a UTC timestamp matching 9 AM in each respective timezone (accounting for current DST). Confirm `wait-for-send-window` step is queued with that timestamp. Confirm `isNonHolidayWeekdayInTz` is called with the local date, not the UTC date.

### Implementation

- [X] T006 [US1] Add `resolve-send-time` step to `src/inngest/functions/analytics-report.ts` — positioned after `fetch-client-config`; iterates up to 7 days from `scheduledAt` using `next9amInTimezone` + `isNonHolidayWeekdayInTz`; returns ISO string; logs warning + returns `scheduledAt` if no valid day found in 7 iterations
- [X] T007 [US1] Add `wait-for-send-window` step to `src/inngest/functions/analytics-report.ts` — positioned after `resolve-send-time`; calls `step.sleepUntil("wait-for-send-window", sendTime)` where `sendTime` is the ISO string from T006
- [X] T008 [US1] Update `tests/unit/inngest/functions/analytics-report.test.ts` — add tests for `resolve-send-time` (ET winter → 14:00 UTC, ET summer → 13:00 UTC, PT winter → 17:00 UTC, Saturday deferred to Monday, holiday deferred, 7-day exhaustion fallback) and `wait-for-send-window` (step called with resolved send time)

**Checkpoint**: `npm run type-check` passes; `npm test -- analytics-report` passes

---

## Phase 4: Schedulers — Cron Shift to Midnight UTC + Monthly Simplification (Priority: P1)

**Goal**: Both schedulers fire at midnight UTC (guaranteeing all US 9 AMs are in the future). Monthly scheduler loses its business-day loop entirely — the worker now owns that logic.

**Independent Test**: Confirm `weekly-analytics-scheduler` cron string is `0 0 * * 2`. Confirm `monthly-analytics-scheduler` cron string is `0 0 2 * *`. Confirm monthly scheduler no longer contains `capture-trigger-date`, `check-business-day-*`, or `sleep-until-day-*` steps — it simply fetches clients and fans out.

### Implementation

- [X] T009 [P] Update `src/inngest/functions/weekly-analytics-scheduler.ts` — change cron from `0 9 * * 2` to `0 0 * * 2`
- [X] T010 [P] Simplify `src/inngest/functions/monthly-analytics-scheduler.ts` — change cron from `0 9 2 * *` to `0 0 2 * *`; remove `capture-trigger-date` step, all `check-business-day-N` steps, all `sleep-until-day-N` steps; reduce to `fetch-active-clients` → `fan-out-report-events`; pass `scheduledAt: new Date().toISOString()` in event payload
- [X] T011 [P] Update `tests/unit/inngest/functions/weekly-analytics-scheduler.test.ts` — update any cron string assertions to `0 0 * * 2`
- [X] T012 Update `tests/unit/inngest/functions/monthly-analytics-scheduler.test.ts` — remove all business-day step tests; add assertions that scheduler fans out immediately; update cron string assertion to `0 0 2 * *`

**Checkpoint**: `npm run type-check` passes; `npm test` passes (all suites)

---

## Phase 5: User Story 3 — Timezone Validation on Client Record (Priority: P2)

**Goal**: `ClientRow.timezone` is validated against `SUPPORTED_TIMEZONES` at runtime. Any workflow or script writing a timezone value is guarded. The DB default ensures existing clients receive CT delivery with zero disruption.

**Independent Test**: Attempt to call `getClientById()` — confirm returned row includes `timezone` typed as `SupportedTimezone`. Confirm a seed client without an explicit timezone receives `"America/Chicago"`. Attempt a manual DB insert with an unsupported timezone string and confirm the application-layer guard would reject it.

### Implementation

- [X] T013 [US3] Add `isValidTimezone(tz: unknown): tz is SupportedTimezone` guard function to `src/types/index.ts` (or `src/utils/timezone.ts`) — checks membership in `SUPPORTED_TIMEZONES`
- [X] T014 [US3] Update `scripts/seed-data.ts` — add `timezone` field to at least one test client per supported timezone (ET, CT, MT, PT) so local dev covers all four

**Checkpoint**: `npm run db:migrate` applies V004 cleanly; seed data inserts without error; `npm run type-check` passes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Observability and final validation

- [X] T015 [P] Add timezone to workflow logging in `src/inngest/functions/analytics-report.ts` — log `client.timezone` and resolved `sendTime` (ISO string) at the start of the `resolve-send-time` step
- [X] T016 Run `npm run type-check` and `npm test` — confirm zero type errors and all tests pass
- [X] T017 Update `CLAUDE.md` project structure section — add `timezone.ts` to the `src/utils/` listing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Migration)**: No dependencies — start immediately
- **Phase 2 (Types + Utility)**: Depends on Phase 1 (needs `ClientRow.timezone` typed) — BLOCKS Phase 3/4/5
- **Phase 3 (Worker Steps)**: Depends on Phase 2 — needs `timezone.ts` + updated `ClientRow`
- **Phase 4 (Schedulers)**: Depends on Phase 2 (type-check) — T009 and T010 can run in parallel with each other and partially in parallel with Phase 3
- **Phase 5 (Validation)**: Depends on Phase 2 — can run in parallel with Phase 3
- **Phase 6 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US3 (types + migration)**: Must land in Phase 2 before US1/US2 worker code compiles
- **US1 + US2 (worker steps)**: Depend on US3 types; both resolved in same worker function
- **Scheduler changes (Phase 4)**: Independent of worker changes — can overlap

### Parallel Opportunities

- T002 and T003 (types additions) can be done together in one edit
- T009 (weekly cron) and T010 (monthly simplification) can run in parallel
- T011 (weekly test update) and T012 (monthly test update) can run in parallel
- T013 (guard fn) and T014 (seed data) can run in parallel
- T015 (logging) and T016 (type-check + test) run last

---

## Parallel Example: Phase 4

```bash
# These two files are independent — run in parallel:
Task T009: Update weekly-analytics-scheduler.ts cron to 0 0 * * 2
Task T010: Simplify monthly-analytics-scheduler.ts — new cron + remove loop

# Then in parallel:
Task T011: Update weekly-analytics-scheduler.test.ts cron assertion
Task T012: Update monthly-analytics-scheduler.test.ts — remove business-day tests
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 — core delivery logic)

1. Phase 1: V004 migration
2. Phase 2: Types + `timezone.ts` utility + unit tests
3. Phase 3: Worker `resolve-send-time` + `wait-for-send-window` steps + tests
4. **STOP and VALIDATE**: trigger analytics-report worker against a test client — confirm 9 AM local sleep fires correctly
5. Phase 4: Cron + scheduler simplification

### Full Delivery

6. Phase 5: Validation guard + seed data
7. Phase 6: Logging + final type-check + CLAUDE.md update

### Notes

- The monthly scheduler's business-day loop is being **removed** in Phase 4 (T010). This is a simplification, not a regression — the loop moves into the worker in Phase 3 (T006).
- `next9amInTimezone` relies on `Intl.DateTimeFormat` integer-hour shift — correct for all four US timezones; documented as out-of-scope for half-hour offsets.
- V004 migration uses `DEFAULT 'America/Chicago'` so existing rows are backfilled automatically — no data migration script needed.
