# Implementation Plan: Form Submission Notification

**Branch**: `003-form-notification` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-form-notification/spec.md`

---

## Summary

Add a single Inngest workflow function (`send-form-notification`) triggered by the `form/submitted` event. The function validates the payload, looks up the client, and sends a notification email containing the submitter's details. No new packages or database tables are required — the function composes entirely from the shared infrastructure built in 002.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: All from 002 — `inngest ^3.x`, `@neondatabase/serverless`, `resend`, `ws`, `tsx`
**Storage**: No new tables — reads `clients` table via existing `getClientById()`
**Testing**: Manual via `npm run test:form` + Inngest Dev UI at `http://localhost:8288`
**Target Platform**: Node.js 20+ server (long-running process)
**Project Type**: web-service (Inngest workflow function)
**Performance Goals**: Notification delivered within 2 minutes of event receipt (SC-001)
**Constraints**: No new production dependencies; stays within Inngest free tier
**Scale/Scope**: 1 new function file, 1 new type, 1 new test script, 1 index update

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. Event-Driven Workflow First | Triggered by `form/submitted`; all ops in `step.run()` | ✅ PASS | 4 named steps: validate, fetch, send, log |
| II. Multi-Environment Safety | Routes through `sendEmail` — mock/test/live enforced automatically | ✅ PASS | No direct Resend calls in the function |
| III. Multi-Tenant by Design | `clientId` required in payload; `getClientById()` called before any action | ✅ PASS | No client data hardcoded |
| IV. Observability by Default | `config.env` logged at start; named steps; email outcome logged | ✅ PASS | clientId in all log calls |
| V. AI-Agent Friendly | Follows template pattern; `FormSubmittedPayload` type in `src/types/index.ts` | ✅ PASS | Function ID: `send-form-notification` |
| VI. Minimal Infrastructure | Zero new packages | ✅ PASS | Smallest possible implementation |

**Post-design re-check**: All gates still pass. The event contract in `contracts/event-contract.md` confirms the function ID and event name convention are correct.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-form-notification/
├── plan.md                    ✅ This file
├── research.md                ✅ Phase 0 output
├── data-model.md              ✅ Phase 1 output
├── quickstart.md              ✅ Phase 1 output
├── contracts/
│   └── event-contract.md     ✅ Phase 1 output
└── tasks.md                   (Phase 2 — /speckit.tasks output)
```

### Source Code (new and modified files)

```text
src/
├── types/
│   └── index.ts                          # MODIFY: add FormSubmittedPayload interface
└── inngest/
    └── functions/
        ├── index.ts                      # MODIFY: export sendFormNotification
        └── form-notification.ts          # NEW: send-form-notification workflow

scripts/
└── test-form-notification.ts             # NEW: sends test event to local dev server

package.json                              # MODIFY: add test:form script
```

**Structure Decision**: Single-project layout. No new directories required — all files fit into the existing structure mandated by the constitution.

---

## Complexity Tracking

> No constitution violations. All gates pass without exception. This is the simplest possible workflow that satisfies all spec requirements.
