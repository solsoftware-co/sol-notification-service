# Research: Flexible Form Notification Fields (015)

**Date**: 2026-04-11  
**Status**: Complete — no unknowns remain

## Summary

No external research was required. All decisions are resolved by reading the existing codebase. Findings are documented below.

---

## Decision 1: Email template already supports most new fields

**Decision**: Wire up existing optional props in `SalesLeadV1Email` rather than redesigning the template.

**Rationale**: `sales-lead-v1.tsx` already defines `customerPhone?`, `interestedIn?`, `sourcePageText?`, and `sourcePageLink?` as optional props. These are rendered conditionally by the `FieldGroup` and metadata section. The new `submitterPhone` and `submittedFrom` fields map directly to `customerPhone` and `sourcePageLink`/`sourcePageText`. No new template props are needed for these two fields; only the mapping in `renderFormNotificationEmail()` in `templates.ts` was missing.

**Alternatives considered**: Adding a new template version (sales-lead-v2) — rejected because the existing template already handles optional rendering correctly and there is no breaking visual change.

---

## Decision 2: `customFields` rendered via FieldGroup array extension

**Decision**: Convert `customFields: Record<string, string>` entries to additional `{ label, value }` items appended to the `fields` array in `SalesLeadV1Email`, rendered after standard fields and before comments.

**Rationale**: `FieldGroup` already accepts an array of `{ label, value, href? }` objects and renders them consistently. Appending custom entries to this array reuses existing layout logic without any new component. An "Additional Details" divider line above the custom fields section makes them visually distinct.

**Alternatives considered**:
- New `customFieldsSection` prop on the template — rejected as over-engineering; the FieldGroup array approach achieves the same result with zero new props.
- A separate `<MessageBlock>` per custom field — rejected; `FieldGroup` gives more structured layout.

---

## Decision 3: `customerName` and `customerEmail` made optional in the template; CTA button made conditional

**Decision**: Change `customerName`, `customerEmail`, and `comments` to optional in `InquiryEmailProps`. Render the CTA "Reply to…" button only when `customerEmail` is present; omit it otherwise.

**Rationale**: With `submitterEmail` no longer required, the template must not crash when `customerEmail` is absent. The `mailto:${customerEmail}` href and "Reply to ${customerName}" label both require those values. Conditional rendering is the minimal-change fix.

**Alternatives considered**: Showing a disabled or placeholder CTA button — rejected; no-op CTAs are poor UX and the spec requires no blank sections for omitted fields.

---

## Decision 4: `formName` replaces `formId` as the subject-line identifier

**Decision**: Use `formName` in the email subject when present (`New form submission: ${formName} — ${client.name}`). `formId` is marked `@deprecated` in the type and is silently ignored by `renderFormNotificationEmail`.

**Rationale**: `formName` is human-readable (e.g., "Contact Form") while `formId` was a machine identifier (e.g., "contact"). The subject line is client-facing, so the readable version is strictly better.

**Alternatives considered**: Reading `formId` as a fallback — rejected per the spec assumption that `formId` is deprecated and will not appear in emails or logs.

---

## Decision 5: `REQUIRED_FIELDS` array reduced to `["clientId"]`

**Decision**: In `form-notification.ts`, the `REQUIRED_FIELDS` constant is updated to `["clientId"]` only. The validate-payload step throws only when `clientId` is absent or empty.

**Rationale**: This is the direct implementation of FR-001. All other fields were moved to optional in the spec. Existing callers are unaffected because present fields are still passed through to rendering.

**Alternatives considered**: Keeping `submitterEmail` required as a minimum — rejected; the spec explicitly states a payload with only `clientId` must succeed (User Story 1, Scenario 2).

---

## Decision 6: No new packages needed

**Decision**: Zero new dependencies.

**Rationale**: The full feature is achievable with the existing stack. `customFields` HTML-escaping is handled by React's JSX renderer (which escapes string content by default). No additional sanitization library is required.

---

## Affected Files

| File | Change type |
|---|---|
| `src/types/index.ts` | Update `FormSubmittedPayload` — optional fields, new fields, deprecate `formId` |
| `src/inngest/functions/form-notification.ts` | Reduce `REQUIRED_FIELDS` to `["clientId"]` |
| `src/lib/templates.ts` | Update `renderFormNotificationEmail()` to map all new/changed fields |
| `src/emails/templates/sales-lead-v1.tsx` | Make `customerName`, `customerEmail`, `comments` optional; add `customFields` support; conditional CTA |
| `tests/unit/inngest/functions/form-notification.test.ts` | Update validate-payload tests; add minimal-payload and partial-payload tests |
| `tests/unit/lib/templates.test.ts` | Add tests for new field rendering and `customFields` section |
