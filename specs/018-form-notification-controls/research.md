# Research: Form Notification Payload Controls

**Feature**: 018-form-notification-controls  
**Date**: 2026-04-14

---

## Decision 1: CTA Resolution Location

**Decision**: Resolve the CTA (`ctaHref`, `ctaLabel`) in `renderFormNotificationEmail` in `templates.ts`, then pass the result as props to `SalesLeadV1Email`. The template itself contains no resolution logic.

**Rationale**: The template is a presentation layer — it should only render what it's given. Keeping resolution in `templates.ts` means the logic is testable without rendering HTML, and the template props remain simple strings. The existing pattern in the codebase (e.g. how chart data is built before being passed to `AnalyticsReportV1Email`) confirms this is the right boundary.

**Alternatives considered**:
- Resolution inside the React template component — mixes business logic into the presentation layer; harder to unit-test without a React render; rejected.
- Resolution inside `form-notification.ts` (the Inngest function) — leaks email rendering concerns into the workflow; rejected.

---

## Decision 2: Template Prop Shape

**Decision**: Add two optional props to `SalesLeadV1Email`: `ctaHref?: string` and `ctaLabel?: string`. The button renders if and only if `ctaHref` is present. The existing `customerEmail`-based button render is replaced by this pattern.

**Rationale**: Minimal prop surface. The template doesn't need to know the action type — it just renders a button for a given href. The href shape (`mailto:...` vs `https://...`) encodes the action type already.

**Alternatives considered**:
- Pass the full `ctaButton` object to the template — couples the template to a payload-level type; rejected.
- Keep `customerEmail`-based render alongside new props — dual code paths increase complexity; rejected.

---

## Decision 3: `target="_blank"` for URL action

**Decision**: For `type: "url"` actions, add `target="_blank"` to the `CTAButton` component's underlying anchor element via the `href` prop. React Email's `<Button>` renders an anchor tag and passes through standard HTML attributes.

**Rationale**: `target="_blank"` is the standard mechanism to open a link in a new tab. Most email clients support it for links; those that don't will open in the default browser window — a safe fallback. No changes needed to the `CTAButton` component itself; the href is passed through as-is.

**Alternatives considered**:
- Custom `CTAButton` variant — unnecessary complexity for a standard HTML attribute; rejected.

---

## Decision 4: `sendEmail: false` Skip Behaviour

**Decision**: The `send-email` Inngest step returns `{ skipped: true, reason: "sendEmail=false" }` immediately when `data.sendEmail === false`, without calling `sendEmail()`. The step result is logged. The `log-result` step records outcome as `"skipped"` in the notification log (live mode only).

**Rationale**: Mirrors the existing skip pattern used in `sync-to-google-sheets` (returns `{ skipped: true, reason: "..." }`). Consistent, observable via the Inngest dashboard, and non-throwing. The `sendEmail: false` check is strictly `=== false` — `undefined` and `true` both proceed normally.

**Alternatives considered**:
- Skip at `validate-payload` level — prevents Sheets sync from running; rejected (spec requires Sheets to still execute).
- A separate `skip-email` step before `send-email` — extra step for a single boolean check; rejected in favour of the inline guard.

---

## Decision 5: URL Validation

**Decision**: A URL is valid if it is a non-empty string starting with `http://` or `https://` (case-insensitive prefix check). No DNS lookup, no URL parsing.

**Rationale**: Sufficient for preventing obviously broken values (empty string, missing protocol) while staying simple and dependency-free. The email provider or browser will surface invalid URLs at delivery/click time.

**Alternatives considered**:
- `new URL(value)` constructor — throws on malformed input but is strict about encoding; works but adds a try/catch; accepted as the implementation approach since it's stdlib.
- External validation library — violates Principle VI; rejected.

---

## No NEEDS CLARIFICATION items remain.
