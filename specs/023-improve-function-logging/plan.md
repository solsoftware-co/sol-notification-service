# Implementation Plan: Improve Inngest Function Logging

**Branch**: `023-improve-function-logging` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/023-improve-function-logging/spec.md`

## Summary

Rewrite log messages across all Inngest workflow functions to be plain-English sentences with key values (clientId, emails, property IDs, date ranges) embedded directly in the message string. Add `AsyncLocalStorage`-based run context to `src/utils/logger.ts` so every `log()` call automatically includes `runId` and `clientId` without requiring explicit parameter threading. Add action-boundary logs to I/O helper functions (`analytics.ts`, `sheets.ts`, `email.ts`).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `pino ^9.x`, `@logtail/pino ^3.x` — all existing; zero new packages  
**Storage**: N/A — no schema changes  
**Testing**: Vitest 2.x — existing unit tests that assert on exact log messages will need updating  
**Target Platform**: Node.js 20+ / Vercel serverless  
**Project Type**: Notification service (event-driven Inngest workflows)  
**Performance Goals**: No measurable impact — `AsyncLocalStorage` adds sub-microsecond overhead per log call  
**Constraints**: `clientId` must remain in the structured context object (second arg to `log()`) to preserve Better Stack log filtering; `runId` is additive  
**Scale/Scope**: 4 Inngest function files + 3 lib files; ~20 log call sites total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Event-Driven Workflow First | ✅ PASS | No changes to Inngest workflow structure or step primitives |
| II. Multi-Environment Safety | ✅ PASS | `runId` and `clientId` are env-agnostic; logging behaviour is identical across envs |
| III. Multi-Tenant by Design | ✅ PASS | `clientId` stays in structured context; `runId` added as additive correlation field |
| IV. Observability by Default | ✅ PASS | This feature directly serves Principle IV — improving log narrative and run correlation |
| V. AI-Agent Friendly Codebase | ✅ PASS | No workflow pattern changes; `template.ts` will be updated to reflect new log style |
| VI. Minimal Infrastructure | ✅ PASS | `AsyncLocalStorage` is a Node.js built-in (`node:async_hooks`); zero new packages |

**All gates pass. No Complexity Tracking required.**

## Project Structure

### Documentation (this feature)

```text
specs/023-improve-function-logging/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A — no new entities)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files modified)

```text
src/
├── utils/
│   └── logger.ts                          # ADD AsyncLocalStorage + setRunContext()
├── inngest/functions/
│   ├── template.ts                        # UPDATE log style as canonical example
│   ├── form-notification.ts               # ADD setRunContext(); REWRITE log messages
│   ├── analytics-report.ts                # ADD setRunContext(); REWRITE log messages
│   ├── weekly-analytics-scheduler.ts      # ADD setRunContext(); REWRITE log messages
│   └── monthly-analytics-scheduler.ts     # ADD setRunContext(); REWRITE log messages
└── lib/
    ├── analytics.ts                       # ADD action-boundary log before GA4 query
    ├── sheets.ts                          # ADD action-boundary log before append; IMPROVE success log
    └── email.ts                           # ADD action-boundary log before Resend send
```

**Structure Decision**: Single project, existing layout — no new files or directories in `src/`.
