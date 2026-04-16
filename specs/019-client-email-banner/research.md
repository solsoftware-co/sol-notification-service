# Research: Per-Client Email Banner Configuration

**Feature**: 019-client-email-banner
**Date**: 2026-04-16

---

## Finding 1: Image Fetching Strategy

**Decision**: Use Node.js 20+ native `fetch` to download banner images from URLs at render time. Convert the response buffer to base64 and embed as an inline CID attachment — the same mechanism already used for the local default banner.

**Rationale**: Node 20 ships `fetch` natively; no new packages required. The existing `loadBannerAttachment()` function already produces a base64-encoded CID attachment — fetching from a URL instead of the filesystem is a drop-in substitution. The Content-Type header from the HTTP response provides the MIME type; fall back to `image/png` if absent.

**Alternatives considered**:
- **Streaming/piping directly into the email attachment**: More complex, no advantage for the typical small logo images this feature targets.
- **New npm package (e.g., `node-fetch`, `got`)**: Unnecessary — Node 20 native `fetch` is sufficient and keeps the stack unchanged.

---

## Finding 2: Fallback Chain

**Decision**: Three-level fallback per render call:
1. Client's configured `imageUrl` — fetch from URL; use if successful
2. Local default file (`assets/banner_image.png`) — use if URL fetch fails or no URL configured
3. No banner — if both above fail, return no attachment and render without a banner image

**Rationale**: Matches FR-005, FR-006, FR-007. Ensures email delivery is never blocked by a missing or unreachable banner image. Failure at level 1 is logged as a warning but does not propagate.

**Alternatives considered**:
- **Throw on URL failure**: Rejected — would cause Inngest step failure and retry spam for a cosmetic issue.
- **Cache fetched images**: Out of scope for this feature; Inngest functions are stateless per invocation.

---

## Finding 3: Where to Read Banner Config

**Decision**: Read `client.settings.banner` inside `renderFormNotificationEmail` and `renderAnalyticsReportEmail` in `src/lib/templates.ts`. Both functions already receive `client: ClientRow` — no changes to function signatures are needed.

**Rationale**: `templates.ts` is the single place that controls email rendering for both workflows. Reading config here keeps the Inngest functions unchanged (they already pass `client` to the render functions). This satisfies Constitution Principle III (multi-tenant by design) — config comes from the DB-fetched client row, not from env vars or constants.

**Alternatives considered**:
- **Read config in the Inngest function and pass as a separate argument**: More verbose, spreads client-settings-parsing logic across files.
- **Add a new DB query at render time**: Unnecessary — `client` is already fetched by the calling function's `fetch-client-config` step.

---

## Finding 4: Banner Component Props

**Decision**: Add optional `height?: number` and `width?: number` props to the `Banner` component. The `src` attribute remains `cid:banner_image.png` (the CID is fixed — only the embedded image file changes, not the reference in the HTML).

**Rationale**: The CID embedding mechanism is already wired in both email templates and the `loadBannerAttachment` return value. Changing what image the CID points to (by varying the attachment content) while keeping the CID constant requires zero changes to the template HTML structure. Dimension props are the only visual change exposed to the component.

**Alternatives considered**:
- **Pass `src` as a prop**: Would require a different CID per client, complicating attachment management. No benefit.
- **Separate `BannerCustom` component**: Unnecessary duplication for a two-prop change.

---

## Finding 5: Settings Schema Location

**Decision**: Banner config is stored as a `banner` sub-key within the existing `clients.settings` JSONB column:

```json
{
  "banner": {
    "imageUrl": "https://cdn.example.com/client-logo.png",
    "height": 60,
    "width": 200
  }
}
```

**Rationale**: No DB migration required. The `settings` JSONB column already holds notification preferences (`settings.notifications`) — adding `settings.banner` follows the same established pattern. This satisfies FR-008.

**Alternatives considered**:
- **New `banner_image_url`, `banner_height`, `banner_width` columns**: Requires a V004 migration. No queryable advantage over JSONB for this use case.

---

## Finding 6: Validation

**Decision**: Validate `imageUrl` as a parseable absolute URL (`new URL(value)` succeeds AND protocol is `http:` or `https:`). Validate `height` and `width` as integers greater than zero. Validation runs inside `renderFormNotificationEmail` / `renderAnalyticsReportEmail` before the fetch attempt — invalid config falls back gracefully rather than throwing.

**Rationale**: No dedicated config-write path exists today (config is set directly on the client row). Validation at render time is the only reliable enforcement point. The fallback behaviour (log warning, use default) is safer than throwing at render time. This satisfies FR-009 and FR-010 in spirit while maintaining email delivery resilience (FR-007).

**Alternatives considered**:
- **Strict throw on invalid config**: Rejected — would turn a bad banner URL into a broken email workflow. Not proportional to the severity of a cosmetic misconfiguration.
- **Validation utility in `src/lib/config.ts`**: That module is for environment config only; mixing client settings validation there would violate single-responsibility.
