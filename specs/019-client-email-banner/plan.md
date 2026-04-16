# Implementation Plan: Per-Client Email Banner Configuration

**Branch**: `019-client-email-banner` | **Date**: 2026-04-16 | **Spec**: [spec.md](spec.md)

## Summary

Allow each client to configure a custom banner image (via hosted URL) and display dimensions (height, width) for all outbound emails. Configuration is stored in the existing `clients.settings` JSONB column under a `banner` sub-key — no DB migration required. At render time, `templates.ts` reads the client's banner config, fetches the image from the URL (falling back to the local default on failure), and passes dimensions to the `Banner` email component. Both email types (form notification, analytics report) are updated together.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@react-email/components`, `@react-email/render` (existing); Node.js 20 native `fetch` (no new packages)
**Storage**: Neon PostgreSQL — no schema changes; `clients.settings` JSONB absorbs the new `banner` sub-key
**Testing**: Vitest 2.x (existing)
**Target Platform**: Vercel (Node.js 20 serverless)
**Project Type**: web-service (notification/email)
**Performance Goals**: Banner image fetch adds one HTTP round-trip per email render; acceptable for async Inngest step execution
**Constraints**: Zero new npm packages; no DB migration; zero visual regression for clients without banner config
**Scale/Scope**: Applied to all clients; N clients × 2 email types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ PASS | No new Inngest functions; existing functions unchanged. Changes are purely in rendering layer. |
| II — Multi-Environment Safety | ✅ PASS | No new env vars. Banner config comes from the DB client row, not from environment. `EMAIL_MODE` mock/test/live behaviour unchanged. |
| III — Multi-Tenant by Design | ✅ PASS | Banner config is stored per-client in the DB and fetched via the existing `fetch-client-config` step. Never hardcoded. |
| IV — Observability by Default | ✅ PASS | URL fetch failures logged as warnings with `clientId`. No new step names needed — changes happen inside existing `send-email` steps. |
| V — AI-Agent Friendly | ✅ PASS | Spec exists. No new function IDs or event payload types. `ClientBannerConfig` type added to `src/types/index.ts`. |
| VI — Minimal Infrastructure | ✅ PASS | Zero new npm packages. Node.js 20 native `fetch` used. No new infrastructure. |

## Project Structure

### Documentation (this feature)

```text
specs/019-client-email-banner/
├── plan.md              # This file
├── research.md          # Phase 0 — image fetch strategy, fallback chain, settings schema
├── data-model.md        # Phase 1 — ClientBannerConfig type, affected files, no-op files
├── quickstart.md        # Phase 1 — step-by-step local testing guide
├── contracts/
│   └── client-settings-banner.md  # Client settings schema contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes (repository root)

```text
src/
├── types/
│   └── index.ts                          # + ClientBannerConfig interface
├── emails/
│   └── components/
│       └── banner.tsx                    # + optional height, width props
│   └── templates/
│       ├── sales-lead-v1.tsx             # + bannerHeight?, bannerWidth? props → <Banner>
│       └── analytics-report-v1.tsx       # + bannerHeight?, bannerWidth? props → <Banner>
└── lib/
    └── templates.ts                      # loadBannerAttachment(url?) + read client.settings.banner
                                          # in renderFormNotificationEmail + renderAnalyticsReportEmail

tests/
└── unit/
    └── lib/
        └── templates.test.ts             # + banner config resolution tests
    └── emails/
        └── components/
            └── banner.test.tsx           # + dimension prop rendering tests (new or extended)
```

**Structure Decision**: Single-project layout. All changes are within existing files — no new source files required. Test coverage extends existing `templates.test.ts`.

## Implementation Approach

### Phase A — Type & Component (no logic, no side effects)

1. Add `ClientBannerConfig` to `src/types/index.ts`
2. Update `Banner` component to accept optional `height` and `width` props (defaults: height=40, width=unset)
3. Update `InquiryEmailProps` (sales-lead-v1) and analytics email props to accept `bannerHeight?` and `bannerWidth?`; pass to `<Banner>`

### Phase B — Image Resolution Logic

4. Refactor `loadBannerAttachment()` in `templates.ts`:
   - New signature: `loadBannerAttachment(imageUrl?: string): Promise<EmailAttachment>`
   - If `imageUrl` provided: `fetch(imageUrl)`, read response as `ArrayBuffer`, base64-encode, use `Content-Type` header for MIME type (default `image/png`)
   - On any fetch error: log warning with `imageUrl`, fall back to local file read
   - If local file read also fails: return `null` (caller omits banner attachment)
5. Add `parseBannerConfig(settings: Record<string, unknown>): ClientBannerConfig` utility in `templates.ts`:
   - Reads `settings.banner`, validates `imageUrl` (URL parse + http/https), `height`/`width` (positive integers)
   - Invalid fields logged as warnings, excluded from returned config

### Phase C — Wire Into Both Render Functions

6. `renderFormNotificationEmail`: call `parseBannerConfig(client.settings)`, pass `imageUrl` to `loadBannerAttachment`, pass `height`/`width` to `SalesLeadV1Email`
7. `renderAnalyticsReportEmail`: same pattern

### Phase D — Tests

8. Unit tests for `parseBannerConfig`: valid config, invalid URL, invalid dimensions, partial config, missing config
9. Unit tests for `loadBannerAttachment`: URL fetch success, URL fetch failure (fallback), local file fallback
10. Unit tests for both render functions: banner config read from `client.settings`, correct attachment produced

## Complexity Tracking

*No constitution violations — table not required.*
