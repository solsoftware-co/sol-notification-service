# Implementation Plan: Per-Client Timezone for 9 AM Local Delivery

**Branch**: `022-client-timezone` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/022-client-timezone/spec.md`

## Summary

Add a `timezone` field to client records (TEXT, allowlist-validated, default `America/Chicago`) and move the "when to send" decision from the schedulers into the per-client analytics-report worker. Each worker independently computes the next 9 AM in its client's timezone, checks whether that date is a US business day, defers by 24 hours if not (up to 7 iterations), then sleeps until the exact send moment. Both schedulers simplify — their crons shift to midnight UTC and their business-day loops are removed. Zero new packages required: Node 20's built-in `Intl.DateTimeFormat` covers all timezone and DST math for whole-hour US offsets.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `@neondatabase/serverless ^1.x` — no new packages required  
**Storage**: Neon PostgreSQL — V004 migration adds `timezone TEXT NOT NULL DEFAULT 'America/Chicago'` to `clients`  
**Testing**: Vitest 2.x + `@inngest/test ^0.1.x`  
**Target Platform**: Vercel (production), local dev server (development)  
**Project Type**: DB migration + Inngest workflow update (scheduler + worker)  
**Performance Goals**: No change — worker sleep duration increases (up to 17 hrs for PT) but Inngest handles long sleeps natively  
**Constraints**: US timezones only (ET/CT/MT/PT); all are whole-hour UTC offsets — no half-hour edge cases  
**Scale/Scope**: Touches two schedulers + one worker + one migration + new timezone utility

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ PASS | `wait-for-send-window` uses `step.sleepUntil()`; business-day loop uses `step.run()` + `step.sleepUntil()` in the worker |
| II — Multi-Environment Safety | ✅ PASS | Sleep step is a no-op in `@inngest/test`; testOnly/limit guards unchanged in schedulers |
| III — Multi-Tenant by Design | ✅ PASS | Timezone read from `client.timezone` at runtime — each client fully independent |
| IV — Observability by Default | ✅ PASS | Send time and timezone logged at workflow start; descriptive step names |
| V — AI-Agent Friendly | ✅ PASS | Spec exists; types updated first; follows established step patterns |
| VI — Minimal Infrastructure | ✅ PASS | Zero new packages; `Intl.DateTimeFormat` is Node 20 built-in |

**Post-design re-check**: All gates hold. Moving the business-day loop into the worker actually simplifies both schedulers (removes the loop entirely from them) and aligns better with Principle III — each client independently owns its send-time decision.

## Project Structure

### Documentation (this feature)

```text
specs/022-client-timezone/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── events.md        # Phase 1 output — unchanged event schemas (timezone is internal)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
db/
└── migrations/
    └── V004__add_client_timezone.sql              # NEW: timezone column + index

src/
├── types/
│   └── index.ts                                   # UPDATE: SUPPORTED_TIMEZONES const, SupportedTimezone type, ClientRow.timezone
├── utils/
│   └── timezone.ts                                # NEW: next9amInTimezone(), localDateStr(), isNonHolidayWeekdayInTz()
└── inngest/
    └── functions/
        ├── analytics-report.ts                    # UPDATE: add resolve-send-time + business-day loop + wait-for-send-window steps
        ├── weekly-analytics-scheduler.ts          # UPDATE: cron midnight UTC (0 0 * * 2); remove no-op (was no loop here)
        └── monthly-analytics-scheduler.ts        # UPDATE: cron midnight UTC (0 0 2 * *); remove business-day loop

tests/
└── unit/
    ├── utils/
    │   └── timezone.test.ts                       # NEW: next9amInTimezone(), localDateStr(), isNonHolidayWeekdayInTz()
    └── inngest/
        └── functions/
            └── analytics-report.test.ts           # UPDATE: add timezone sleep step tests
```

**Structure Decision**: Single-project layout. Timezone logic extracted to `src/utils/timezone.ts` (separate from `business-days.ts` — timezone is about time conversion, business-days is about date classification). The two utilities compose: `isNonHolidayWeekdayInTz` in `timezone.ts` calls `isNonHolidayWeekday` from `business-days.ts` after converting to the client's local date.
