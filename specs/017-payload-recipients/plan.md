# Implementation Plan: Per-Invocation Recipient Override

**Branch**: `017-payload-recipients` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the `form/submitted` event payload with an optional `recipients` field. Update `resolveRecipients()` to evaluate a three-tier fallback chain: payload recipients → `settings.notifications.form_submitted` → `client.email`. The function is updated to return both the resolved list and the resolution source tier for logging. No database schema changes are required.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x` — all existing; zero new packages  
**Storage**: No schema changes — recipients live in the event payload only  
**Testing**: Vitest 2.x (existing)  
**Target Platform**: Vercel + Inngest (existing)  
**Project Type**: Event-driven notification service  
**Performance Goals**: No change — recipient resolution is a synchronous in-memory operation  
**Constraints**: Must not break existing callers that omit `recipients`; backwards-compatible signature change required  
**Scale/Scope**: 2 files modified (`notifications.ts`, `form-notification.ts`), 1 type updated (`FormSubmittedPayload`), 1 test file updated

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ PASS | Modifying existing `form/submitted` Inngest function; all logic inside `step.run()` |
| II — Multi-Environment Safety | ✅ PASS | Recipient resolution is env-agnostic; mock/test/live delivery interception unchanged |
| III — Multi-Tenant by Design | ✅ PASS | All resolution still scoped to `clientId`; no cross-tenant data access |
| IV — Observability by Default | ✅ PASS | Adding `recipient_source` field to notification log metadata |
| V — AI-Agent Friendly | ✅ PASS | Spec exists; types defined in `src/types/index.ts` before implementation |
| VI — Minimal Infrastructure | ✅ PASS | Zero new packages, zero new infrastructure, no DB migration |

No gate violations. No Complexity Tracking table required.

---

## Project Structure

### Documentation (this feature)

```text
specs/017-payload-recipients/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/
│   └── resolve-recipients.md   ← Phase 1 output
└── tasks.md         ← Phase 2 output (/speckit.tasks)
```

### Source Code (changes only)

```text
src/
├── types/
│   └── index.ts                          # Add recipients?: string[] to FormSubmittedPayload
├── lib/
│   └── notifications.ts                  # Update resolveRecipients() — new signature + source tier
└── inngest/
    └── functions/
        └── form-notification.ts          # Pass data.recipients; destructure result; log source

tests/
└── unit/
    └── lib/
        └── notifications.test.ts         # Full coverage of three-tier logic (new + existing)
```
