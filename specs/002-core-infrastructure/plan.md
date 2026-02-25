# Implementation Plan: Core Shared Infrastructure

**Branch**: `002-core-infrastructure` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-core-infrastructure/spec.md`

---

## Summary

Build the foundational shared infrastructure that all notification workflows depend on: a single-source environment configuration module, a three-mode email abstraction (mock/test/live), a Neon PostgreSQL database client with typed client lookup, shared TypeScript types, a structured logger, idempotent database setup/seed scripts, and a canonical workflow template. No actual notification workflows are implemented in this feature — only the reusable infrastructure they all require.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `inngest ^3.x` (existing), `@neondatabase/serverless ^0.9.x` (to install), `resend ^3.5.0` (existing), `tsx ^4.x` (existing)
**Storage**: Neon PostgreSQL (serverless) via `@neondatabase/serverless` Pool (WebSocket transport)
**Testing**: Manual smoke tests per acceptance scenarios in spec.md; `npm run type-check` as automated gate
**Target Platform**: Node.js 20+ server (long-running process; not edge/serverless)
**Project Type**: web-service (Inngest workflow server)
**Performance Goals**: < 200ms client lookup (Neon free tier); email send latency dominated by Resend (< 2s)
**Constraints**: All PoC usage stays within free tiers (Neon ≤ 512 MB, Resend ≤ 3k/month); `npm run dev` only
**Scale/Scope**: 2 test clients for PoC; architecture supports up to 100 clients without code changes

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. Event-Driven Workflow First | Template uses `inngest.createFunction` + all ops in `step.run()` | ✅ PASS | Template demonstrates all step patterns |
| II. Multi-Environment Safety | `config.ts` enforces mock→test→live per env; zero real emails in dev | ✅ PASS | email.ts routes all sends through mode check |
| III. Multi-Tenant by Design | `getClientById(clientId)` required in every workflow; template demonstrates this | ✅ PASS | No client data hardcoded |
| IV. Observability by Default | All steps named; `config.env` logged at function start; email outcomes logged | ✅ PASS | logger.ts enforces format |
| V. AI-Agent Friendly | `template.ts` is the canonical pattern; all types in `src/types/index.ts` | ✅ PASS | CLAUDE.md updated via agent script |
| VI. Minimal Infrastructure | Only adds `@neondatabase/serverless`; no Docker; `npm run dev` works | ✅ PASS | Approved in constitution stack table |

**Post-design re-check**: All gates still pass. The module contracts (contracts/module-interfaces.md) enforce that workflows never bypass the abstractions.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-core-infrastructure/
├── plan.md           ✅ This file
├── research.md       ✅ Phase 0 output
├── data-model.md     ✅ Phase 1 output
├── quickstart.md     ✅ Phase 1 output
├── contracts/
│   └── module-interfaces.md  ✅ Phase 1 output
└── tasks.md          (Phase 2 — /speckit.tasks output)
```

### Source Code (new files this feature adds)

```text
src/
├── index.ts                              # MODIFY: import config, checkDbConnection on startup
├── types/
│   └── index.ts                          # NEW: all shared types and event payload interfaces
├── lib/
│   ├── config.ts                         # NEW: environment config singleton
│   ├── db.ts                             # NEW: Neon Pool singleton + getClientById()
│   └── email.ts                          # NEW: mock/test/live email abstraction
├── utils/
│   └── logger.ts                         # NEW: structured logger with env/clientId context
└── inngest/
    └── functions/
        └── template.ts                   # NEW: canonical workflow template (not registered)

scripts/
├── setup-db.ts                           # NEW: idempotent table creation
└── seed-data.ts                          # NEW: insert 2 test clients

.env.local.example                        # NEW: template env file with all variables documented
```

**Structure Decision**: Single-project layout (Option 1), matching the directory layout mandated by the constitution. All new files land under `src/lib/`, `src/utils/`, `src/types/`, and `scripts/`.

---

## Complexity Tracking

> No constitution violations. All gates pass without exception.
