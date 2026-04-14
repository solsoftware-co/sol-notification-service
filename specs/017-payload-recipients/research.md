# Research: Per-Invocation Recipient Override

**Feature**: 017-payload-recipients  
**Date**: 2026-04-13

---

## Decision 1: `resolveRecipients` Return Type

**Decision**: Update `resolveRecipients` to return `{ recipients: string[]; source: "payload" | "settings" | "client_email" }` instead of `string[]`.

**Rationale**: The notification log metadata must record which tier resolved the recipients (FR-007). Returning a structured object from the single resolution call is cleaner than calling the function twice or maintaining a separate side-channel. The function is only called from two places (`form-notification.ts` and `analytics-report.ts`), making the call-site update trivial.

**Alternatives considered**:
- Return `string[]` only, compute source separately — requires calling the resolution logic twice or duplicating it; rejected.
- Add a separate `getRecipientSource()` function — adds unnecessary surface area for a two-property result; rejected.
- Add `source` as a `ref` parameter — not idiomatic TypeScript; rejected.

---

## Decision 2: Function Signature

**Decision**: `resolveRecipients(client, workflowKey, payloadRecipients?: string[] | null)` — the third argument is optional and defaults to `undefined` (treated as absent).

**Rationale**: This is a backwards-compatible extension. All existing callers (`analytics-report.ts`) that omit `payloadRecipients` continue to work unchanged except for the destructure of the return value.

**Alternatives considered**:
- Introduce a separate `resolveRecipientsWithPayload()` function — duplicates the existing logic; rejected.
- Merge everything into the workflow function — violates the encapsulation requirement (FR-008); rejected.

---

## Decision 3: Email Validation Rule

**Decision**: An address is valid if it is a non-empty string that contains exactly one `@` character with at least one character on each side. Same rule as the existing `resolveRecipients` logic (`entry.includes("@")`).

**Rationale**: Consistency with the existing validation in tier-2 resolution. A stricter RFC 5322 regex adds complexity without meaningful benefit for this use case; the email provider will reject truly malformed addresses at delivery time.

**Alternatives considered**:
- Full RFC 5322 regex — significant complexity, common false negatives with valid international addresses; rejected for this PoC.
- External validation library — violates Principle VI (no new packages); rejected.

---

## Decision 4: Case-Insensitive Deduplication

**Decision**: Normalise addresses to lowercase before deduplication. Preserve the original casing for delivery (i.e., deduplicate on lowercased form, but keep the first-seen original).

**Rationale**: Email addresses are case-insensitive in the local part by convention (RFC 5321 §2.3.11). Delivering duplicates wastes quota and creates a confusing recipient experience.

**Alternatives considered**:
- Case-sensitive dedup — `Alice@example.com` and `alice@example.com` would both be delivered; rejected.

---

## Decision 5: `analytics-report.ts` call-site update

**Decision**: Update the `resolveRecipients` call in `analytics-report.ts` to destructure `{ recipients }` from the new return value. No `payloadRecipients` argument is passed (analytics report has no payload-level recipients).

**Rationale**: Required for TypeScript compilation after the return type change. Behaviour is identical to today.

---

## No NEEDS CLARIFICATION items remain.
