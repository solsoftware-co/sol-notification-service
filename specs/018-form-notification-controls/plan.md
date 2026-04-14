# Implementation Plan: Form Notification Payload Controls

**Branch**: `018-form-notification-controls` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the `form/submitted` event payload with two optional controls: `sendEmail` (boolean toggle, defaults to `true`) and `ctaButton` (custom label + action for the email's call-to-action button). The email skip logic goes in the existing `send-email` Inngest step; CTA resolution is isolated to `renderFormNotificationEmail` in `templates.ts`, which computes a final `ctaHref` and `ctaLabel` and passes them as props to the React Email template. No DB changes, no new packages.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `@react-email/components`, `@react-email/render` — all existing; zero new packages  
**Storage**: No schema changes — both fields live in the event payload only  
**Testing**: Vitest 2.x (existing)  
**Target Platform**: Vercel + Inngest (existing)  
**Project Type**: Event-driven notification service  
**Performance Goals**: No change — CTA resolution is a synchronous in-memory operation  
**Constraints**: Must not break existing callers that omit either field; backwards-compatible  
**Scale/Scope**: 4 files modified, 1 type file updated, 2 test files updated

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ PASS | Modifying existing `form/submitted` function; skip logic inside `step.run()` |
| II — Multi-Environment Safety | ✅ PASS | Both controls are env-agnostic; mock/test/live delivery interception unchanged |
| III — Multi-Tenant by Design | ✅ PASS | Payload-level controls; no cross-tenant data |
| IV — Observability by Default | ✅ PASS | `sendEmail: false` skip is logged with reason in the step result |
| V — AI-Agent Friendly | ✅ PASS | Spec exists; types defined in `src/types/index.ts` before implementation |
| VI — Minimal Infrastructure | ✅ PASS | Zero new packages, no DB migration, no new infrastructure |

No gate violations. No Complexity Tracking required.

---

## CTA Resolution Logic

Resolved in `renderFormNotificationEmail` (templates.ts) before passing to the template:

```
1. If ctaButton.action.type === "url":
   a. If url is a valid non-empty https?:// string → ctaHref = url, ctaLabel = ctaButton.text ?? default
   b. If url is missing or invalid → log warning, fall back to default mailto

2. If ctaButton.action.type === "mailto":
   a. email = ctaButton.action.email ?? payload.submitterEmail
   b. ctaHref = `mailto:${email}`, ctaLabel = ctaButton.text ?? default

3. If ctaButton.action is absent but ctaButton.text is set:
   a. Use default mailto action (submitter email) with custom text

4. If ctaButton is absent entirely:
   a. Existing behaviour: ctaHref = `mailto:${submitterEmail}`, ctaLabel = "Reply to {name}" or "Reply"

5. If ctaHref is present → render CTAButton; if absent (no ctaButton + no submitterEmail) → omit button
```

The template (`sales-lead-v1.tsx`) is updated to accept `ctaHref?: string` and `ctaLabel?: string` props and render the button when `ctaHref` is present — no resolution logic inside the template.

For `type: "url"`, the `CTAButton` `href` attribute is the URL and the link is rendered with `target="_blank"` — React Email's `<Button>` component accepts this via the existing `href` prop (email clients that support it will open in a new tab; others will open the link).

---

## Project Structure

### Documentation (this feature)

```text
specs/018-form-notification-controls/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/
│   └── cta-resolution.md   ← Phase 1 output
└── tasks.md         ← Phase 2 output (/speckit.tasks)
```

### Source Code (changes only)

```text
src/
├── types/
│   └── index.ts                              # Add FormNotificationCtaButton + fields to FormSubmittedPayload
├── lib/
│   └── templates.ts                          # resolveCta() helper + pass ctaHref/ctaLabel to template
└── emails/
    └── templates/
        └── sales-lead-v1.tsx                 # Accept ctaHref/ctaLabel props; render when ctaHref present
└── inngest/
    └── functions/
        └── form-notification.ts              # Check sendEmail !== false in send-email step

tests/
└── unit/
    ├── lib/
    │   └── templates.test.ts                 # New tests: CTA resolution scenarios
    └── inngest/
        └── functions/
            └── form-notification.test.ts     # New tests: sendEmail=false skip
```
