# Research: Per-Client Timezone for 9 AM Local Delivery

**Feature**: 022-client-timezone  
**Date**: 2026-04-20

---

## Decision 1: Timezone Math — Pure `Intl.DateTimeFormat` (No New Packages)

**Decision**: Use Node 20's built-in `Intl.DateTimeFormat` with IANA timezone names to compute the UTC timestamp corresponding to 09:00:00 in a target timezone.

**Algorithm**:
1. Get the current local date string (`YYYY-MM-DD`) in the target timezone using `en-CA` locale (produces ISO-format date)
2. Construct a UTC candidate: `new Date(\`${localDateStr}T09:00:00.000Z\`)`
3. Check what local hour that UTC moment corresponds to in the target timezone using `formatToParts`
4. Shift by `(9 - localHour) * 3_600_000 ms` to land exactly on 09:00:00 local
5. If the result is already in the past, add 24 hours

**Why this works for US timezones**: All four supported timezones (ET, CT, MT, PT) use whole-hour UTC offsets (ranging from UTC-8 to UTC-4 depending on DST). There are no half-hour or quarter-hour anomalies. The integer-hour shift produces an exact 09:00:00.000 result every time.

**DST handling**: `Intl.DateTimeFormat` uses the IANA timezone database (V8's ICU data), which encodes every historical and future DST transition. The computed local hour at step 3 is always correct for the actual calendar date, regardless of whether DST is active.

**Rationale**: Zero new dependencies; performant; correct for all US timezones. Would not work for India (UTC+5:30) or Nepal (UTC+5:45) — documented as out of scope.

**Alternatives considered**:
- *`date-fns-tz`*: Excellent library but requires a constitution amendment per Principle VI. Deferred for when international timezones are added.
- *`luxon`*: Same — new dependency, not justified for 4 whole-hour US timezones.
- *Node.js `Temporal` API*: Still experimental in Node 20; not production-ready.

---

## Decision 2: Business-Day Check Moves Into the Worker

**Decision**: Remove the business-day loop from `monthly-analytics-scheduler.ts` entirely. Both schedulers fan out immediately at midnight UTC. The `analytics-report` worker owns the full "when to send" decision: compute send time, check business day, defer if needed, sleep until ready.

**Rationale**: Moving the check into the worker is necessary for correctness — only the worker knows the client's timezone, and the business-day date must be evaluated in that timezone (FR-006). As a side effect, both schedulers become significantly simpler (the monthly scheduler loses its entire loop). Per-client independence (Principle III) is strengthened — each client's deferral logic runs in isolation.

**Impact on monthly scheduler**: The `capture-trigger-date`, `check-business-day-N`, and `sleep-until-day-N` steps are removed. The function becomes: fetch clients → fan out. The `scheduledAt` value passed in the event is `new Date().toISOString()` (midnight UTC on the 2nd) — the worker uses this to resolve "last month".

**Impact on weekly scheduler**: No loop was present. Only the cron string changes.

**Alternatives considered**:
- *Keep business-day check in monthly scheduler, add per-client sleep in worker*: Double-checking adds complexity with no benefit. The scheduler's UTC-based check was always a simplification anyway.
- *Timezone-aware check in scheduler before fan-out*: Would require fetching all clients first, checking each timezone, grouping by send-date — over-engineered for the current scale.

---

## Decision 3: Cron Shifts to Midnight UTC for Both Schedulers

**Decision**:
- Monthly: `0 9 2 * *` → `0 0 2 * *`
- Weekly: `0 9 * * 2` → `0 0 * * 2`

**Rationale**: Midnight UTC guarantees every US timezone's 9 AM is in the future at trigger time (PT is the latest at UTC-8, meaning 9 AM PT = 17:00 UTC — well after midnight). This makes the worker's `next9amInTimezone` sleep always positive with no "already passed" edge case to handle.

**Alternatives considered**:
- *Keep 9 AM UTC*: 9 AM UTC = 4/5 AM ET — still works but the sleep from trigger to send is only 4–5 hours for ET clients, and PT would need to sleep ~13 hours. No correctness issue but midnight UTC provides a more uniform baseline.
- *Per-client cron*: Not supported by Inngest in a multi-tenant fan-out pattern.

---

## Decision 4: `timezone` Column as TEXT with Application Allowlist

**Decision**: `timezone TEXT NOT NULL DEFAULT 'America/Chicago'` in the `clients` table. Validation enforced in application code via a TypeScript `SUPPORTED_TIMEZONES` const array, not a Postgres ENUM.

**Rationale**: Postgres `ENUM` requires `ALTER TYPE` which cannot run in a transaction, making future additions (e.g. `America/Anchorage`, `Europe/London`) schema-migration events. TEXT + application validation keeps the DB flexible while still enforcing the allowlist. Default of `America/Chicago` (CT) matches the prior fixed 2 PM UTC send time (≈ 8 AM CT) — existing clients experience no cadence disruption.

**Allowlist** (encoded as `SUPPORTED_TIMEZONES` in `src/types/index.ts`):
```
America/New_York   — Eastern Time
America/Chicago    — Central Time (default)
America/Denver     — Mountain Time
America/Los_Angeles — Pacific Time
```

**Alternatives considered**:
- *Postgres ENUM*: Rejected — ALTER TYPE constraints described above.
- *UTC offset integer* (e.g. `-6`): Loses DST information — would require manual seasonal updates.

---

## Decision 5: New `src/utils/timezone.ts` Utility (Not Extended into `business-days.ts`)

**Decision**: Create a separate `src/utils/timezone.ts` exporting `next9amInTimezone()`, `localDateStr()`, and `isNonHolidayWeekdayInTz()`. The last function calls `isNonHolidayWeekday()` from `business-days.ts` after converting to the client's local date — composition, not duplication.

**Rationale**: `business-days.ts` classifies dates (is this date a business day?). `timezone.ts` converts between UTC and local time representations. Keeping them separate maintains single-responsibility and makes each independently testable.

**`isNonHolidayWeekdayInTz` design**:
```
localDateStr(tz, date) → "YYYY-MM-DD"
→ new Date("YYYY-MM-DDT00:00:00Z")  (treat local date as UTC for DOW + holiday lookup)
→ isNonHolidayWeekday(localDateAsUtc)
```
This works because `isNonHolidayWeekday` uses `getUTCDay()` and `toISOString().slice(0,10)` — both operate on UTC, and passing the local date string as a UTC date gives the correct day-of-week and date string for the client's calendar.
