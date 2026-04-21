# Implementation Plan: Monthly Analytics Report Scheduler

**Branch**: `021-monthly-analytics-scheduler` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/021-monthly-analytics-scheduler/spec.md`

## Summary

Add a monthly analytics report scheduler that fires on the 2nd of each month at 9 AM UTC, enforces US federal business-day rules (skipping weekends and all 11 federal holidays with observed-date adjustment), and fans out `analytics/report.requested` events with `preset: "last_month"` to every active client once a valid business day is found. If no valid day is found within 7 consecutive days, the run terminates with a logged skip. Implemented entirely within the existing Inngest + TypeScript stack — zero new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x` — no new packages required  
**Storage**: No schema changes; no DB reads beyond the existing `getAllActiveClients()` call  
**Testing**: Vitest 2.x + `@inngest/test ^0.1.x`  
**Target Platform**: Vercel (production), local dev server (development)  
**Project Type**: Inngest workflow function (event-driven, scheduled)  
**Performance Goals**: Same as weekly scheduler — fan-out completes within one Inngest execution cycle  
**Constraints**: Must not dispatch more than once per calendar month per client; non-production runs limited to 1 test client  
**Scale/Scope**: One scheduler function; one dispatch per client per month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ PASS | `inngest.createFunction` with cron + event trigger; all operations in `step.run()` / `step.sleepUntil()` |
| II — Multi-Environment Safety | ✅ PASS | `testOnly: true` + `limit: 1` in non-production; identical to weekly scheduler |
| III — Multi-Tenant by Design | ✅ PASS | Fan-out to per-client `analytics/report.requested` events; each client runs independently |
| IV — Observability by Default | ✅ PASS | Descriptive step names; `config.env` logged at start; dispatch count in return value |
| V — AI-Agent Friendly | ✅ PASS | Spec exists; follows canonical template pattern; event payload typed in `src/types/index.ts` |
| VI — Minimal Infrastructure | ✅ PASS | Zero new packages; pure TypeScript date arithmetic; no new infrastructure |

**Post-design re-check**: All gates hold. The `step.sleepUntil()` loop pattern is an established Inngest primitive — no architecture additions required.

## Project Structure

### Documentation (this feature)

```text
specs/021-monthly-analytics-scheduler/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── events.md        # Phase 1 output — trigger event schema
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                               # ADD: MonthlyScheduledPayload type
├── utils/
│   └── business-days.ts                       # NEW: isNonHolidayWeekday(), getUSFederalHolidays() — reusable across any workflow
└── inngest/
    └── functions/
        ├── index.ts                           # UPDATE: register monthlyAnalyticsScheduler
        └── monthly-analytics-scheduler.ts     # NEW: scheduler function (imports from utils/business-days)

tests/
└── unit/
    ├── utils/
    │   └── business-days.test.ts              # NEW: pure unit tests for holiday helpers
    └── inngest/
        └── functions/
            └── monthly-analytics-scheduler.test.ts   # NEW: Inngest step/fan-out tests
```

**Structure Decision**: Single-project layout, matching all prior feature implementations. Business-day logic extracted to `src/utils/business-days.ts` so any future workflow (e.g. a weekly scheduler variant, a digest mailer) can import `isNonHolidayWeekday` without duplicating the holiday computation.
