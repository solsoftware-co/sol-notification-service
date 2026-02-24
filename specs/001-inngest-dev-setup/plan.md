# Implementation Plan: Inngest Dev Server Setup

**Branch**: `001-inngest-dev-setup` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-inngest-dev-setup/spec.md`

## Summary

Set up the bare-minimum project scaffold required to run the Inngest Dev Server locally
with `npm run dev`. Deliverables: `package.json`, `tsconfig.json`, `.env.example`,
`.gitignore`, an Inngest client, a serve handler entry point, and one example Inngest
function with a `step.run()` call. No database, no email provider, no external integrations.

The serve handler is implemented using the `inngest/node` adapter (raw Node.js HTTP, no
framework). Two processes run concurrently via `concurrently`: the app server (`tsx watch`)
and the Inngest Dev Server (`npx inngest-cli@latest dev`).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `inngest ^3.x` (runtime); `concurrently ^9.x`, `tsx ^4.x`,
  `typescript ^5.x`, `@types/node ^20.x` (devDependencies)
**Storage**: N/A (no database in this feature)
**Testing**: N/A (no test suite in scope)
**Target Platform**: Node.js 20+ (local development); Vercel Functions (future deployment)
**Project Type**: Standalone web-service (Inngest serve handler over Node.js HTTP)
**Performance Goals**: Event processing visible in Dev UI within 10 seconds; setup
  time from `git clone` to running Dev UI under 15 minutes
**Constraints**: No Docker, no framework beyond Node.js built-ins, `npm run dev` only
**Scale/Scope**: Single developer workspace; 1 example function; no external service calls

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Event-Driven Workflow First | ✅ Pass | Example function uses `inngest.createFunction` + `step.run("log-message", ...)`. No direct API calls. |
| II. Multi-Environment Safety | ✅ Pass | `.env.example` documents `EMAIL_MODE=mock` and `VERCEL_ENV=development`. No real emails possible at this stage. |
| III. Multi-Tenant by Design | ✅ N/A | No client-specific logic in this feature. Pattern will be enforced when workflow functions are added. |
| IV. Observability by Default | ✅ Pass | Example function step is named (`"log-message"`). Server logs startup URLs. `config.env` logging added in later feature. |
| V. AI-Agent Friendly Codebase | ✅ Pass | `functions/index.ts` barrel established. File layout matches PRD spec exactly. Template function pattern documented in research.md. |
| VI. Minimal Infrastructure & DX | ✅ Pass | This feature IS the implementation of Principle VI. `npm run dev` only, no Docker. |

**Gate result: PASS** — no violations, no complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/001-inngest-dev-setup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 decisions
├── data-model.md        # Entity and event schemas
├── quickstart.md        # Developer setup guide
├── contracts/
│   └── serve-handler.md # /api/inngest endpoint contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── index.ts                        # HTTP server entry point + serve handler routing
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel: export const functions = [helloWorld]
        └── hello-world.ts          # Example stub function (test/hello.world trigger)

package.json                        # Dependencies + dev/build/start scripts
tsconfig.json                       # CommonJS, ES2022, strict mode
.env.example                        # All env vars documented with defaults
.gitignore                          # Excludes .env.local, node_modules/, dist/
```

**Structure Decision**: Single project layout (Option 1). No `tests/` directory at this
stage — testing is out of scope per the spec. The `src/inngest/` structure establishes the
canonical layout that all future workflow functions will follow per the PRD and constitution.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
