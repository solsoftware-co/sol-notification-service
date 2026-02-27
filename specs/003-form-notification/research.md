# Research: Form Submission Notification

**Feature Branch**: `003-form-notification`
**Date**: 2026-02-27
**Status**: Complete — no NEEDS CLARIFICATION markers; no new external dependencies

---

## Decision 1: No New Dependencies Required

**Decision**: This feature introduces zero new packages. All required capabilities already exist in the codebase from 002-core-infrastructure.

**Rationale**: The workflow needs only three things — a typed event payload, a client lookup, and an email send — all of which are provided by `src/types/index.ts`, `src/lib/db.ts`, and `src/lib/email.ts` respectively.

**What this means for implementation**: Copy `template.ts`, update the event name and payload type, replace the placeholder business logic, add to the function index. That is the entire implementation.

---

## Decision 2: Event Name Convention

**Decision**: Event name is `form/submitted` following the `domain/action.pastTense` convention from the constitution.

**Rationale**: Constitution Principle I requires event names follow `domain/action.pastTense`. `form/submitted` fits: domain = `form`, action = `submitted` (already past tense as a past participle).

**Alternatives considered**:
- `notification/form.submitted` — rejected; the domain should be the thing that happened, not the service responding to it
- `form/submission.received` — rejected; unnecessarily verbose

---

## Decision 3: Payload Validation Approach

**Decision**: Validate required fields (`clientId`, `submitterName`, `submitterEmail`, `submitterMessage`) in the first step using a guard that throws a descriptive error if any are missing.

**Rationale**: FR-003 requires immediate failure with a clear error if required fields are absent. Throwing inside `step.run('validate-payload', ...)` surfaces the error in the Inngest dashboard under that step's name, making it immediately diagnosable (FR-009, SC-003).

**Alternative considered**: TypeScript type enforcement only (no runtime check) — rejected because Inngest events arrive as untyped JSON at runtime; TypeScript types don't prevent malformed external payloads.

---

## Decision 4: Email HTML for This Feature

**Decision**: Construct the email HTML inline as a template literal within the workflow function. No shared template helper yet.

**Rationale**: Issue #3 (email template helpers) is open but not yet implemented. The spec explicitly defers styling to issue #3. Writing inline HTML now is the minimum viable approach that satisfies FR-005 without blocking on the template feature. When issue #3 is implemented, the inline HTML is replaced with a `generateFormNotificationEmailBody(...)` call — a one-line change.

**The email will include**: submitter name, submitter email, submitter message, form ID (or "Unknown form"), and the event arrival timestamp. Plain functional HTML — no styling.

---

## Decision 5: Timestamp Source

**Decision**: Use `new Date().toISOString()` captured at the start of the workflow as the submission timestamp.

**Rationale**: The spec assumption states "the submission timestamp is derived from when the event arrives at the service — no client-side timestamp is required in the payload." Capturing it at the start of the first step is sufficient for the PoC.

---

## Decision 6: Test Script

**Decision**: Add `scripts/test-form-notification.ts` and an `npm run test:form` script that sends the `form/submitted` event to the local Inngest server via `@inngest/sdk` or directly via the HTTP API.

**Rationale**: Consistent with the existing `test-email-preview.ts` pattern. Developers can trigger the full workflow end-to-end from the command line without opening the Inngest Dev UI, though the Dev UI remains the primary observability tool.

**Implementation**: Use `fetch` to POST to `http://localhost:8288/e/{eventKey}` — the Inngest Dev Server's event ingestion endpoint. No new SDK required.
