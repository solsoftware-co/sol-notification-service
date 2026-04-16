# Data Model: Per-Client Email Banner Configuration

**Feature**: 019-client-email-banner
**Date**: 2026-04-16

---

## Schema Changes

**No database migration required.** All banner configuration is stored within the existing `clients.settings` JSONB column, following the same pattern as `settings.notifications`.

---

## New Type: `ClientBannerConfig`

Added to `src/types/index.ts`.

```typescript
export interface ClientBannerConfig {
  /** Absolute URL (http/https) to the banner image to embed in emails. */
  imageUrl?: string;
  /** Display height in pixels. Must be a positive integer. Defaults to 40. */
  height?: number;
  /** Display width in pixels. Must be a positive integer. No default (omit to let email client scale naturally). */
  width?: number;
}
```

**Validation rules** (applied at render time; invalid values fall back to defaults):
- `imageUrl`: must parse as a valid URL with `http:` or `https:` protocol
- `height`: must be a positive integer (> 0)
- `width`: must be a positive integer (> 0)

---

## `clients.settings` JSONB Shape (updated)

```json
{
  "notifications": {
    "form_submitted": ["recipient@example.com"],
    "analytics_report": ["recipient@example.com"]
  },
  "banner": {
    "imageUrl": "https://cdn.example.com/client-logo.png",
    "height": 60,
    "width": 240
  }
}
```

All fields under `banner` are optional. A client with no `banner` key, or a `banner` key with no fields, uses the system defaults for all values.

---

## Default Values

| Field | Default | Source |
|-------|---------|--------|
| `imageUrl` | `assets/banner_image.png` (local file) | Current hardcoded behaviour |
| `height` | `40` | Current hardcoded `Banner` component |
| `width` | (unset — scales naturally) | Current `Banner` component has no width |

---

## Affected Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `ClientBannerConfig` interface |
| `src/emails/components/banner.tsx` | Add optional `height` and `width` props |
| `src/emails/templates/sales-lead-v1.tsx` | Add `bannerHeight?` and `bannerWidth?` to `InquiryEmailProps`; pass to `<Banner>` |
| `src/emails/templates/analytics-report-v1.tsx` | Add `bannerHeight?` and `bannerWidth?` to analytics email props; pass to `<Banner>` |
| `src/lib/templates.ts` | Update `loadBannerAttachment()` to accept optional URL; read `client.settings.banner` in both render functions |

---

## No Changes Required

| File | Reason |
|------|--------|
| `src/inngest/functions/form-notification.ts` | Already passes `client` to `renderFormNotificationEmail` |
| `src/inngest/functions/analytics-report.ts` | Already passes `client` to `renderAnalyticsReportEmail` |
| `src/lib/db.ts` | `settings` column already returned in all client queries |
| `db/migrations/` | No schema changes needed |
| `src/types/index.ts` (ClientRow) | `settings: Record<string, unknown>` already accommodates new sub-keys |
