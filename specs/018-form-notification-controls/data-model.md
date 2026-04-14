# Data Model: Form Notification Payload Controls

**Feature**: 018-form-notification-controls  
**Date**: 2026-04-14

---

## No Database Schema Changes

Both new fields are payload-only. No new tables, columns, or migrations required.

---

## New Types

### `FormNotificationCtaButton`

```
FormNotificationCtaButton
├── text?: string          — Optional label for the CTA button (replaces default)
└── action?: one of:
    ├── { type: "url";    url: string }     — Opens URL in new tab
    └── { type: "mailto"; email?: string }  — Opens mail client; uses submitter email if absent
```

**Validation rules**:
- `text` — optional; empty string treated as absent (falls back to default label)
- `action.type` — must be `"url"` or `"mailto"`; unrecognised values fall back to default with a warning
- `action.url` — required when `type === "url"`; must be a non-empty string starting with `http://` or `https://`; invalid values fall back to default with a warning
- `action.email` — optional when `type === "mailto"`; if absent, `payload.submitterEmail` is used

---

### `FormSubmittedPayload` (extended)

```
FormSubmittedPayload
├── clientId: string                             (required, existing)
├── submitterName?: string                       (existing)
├── submitterEmail?: string                      (existing)
├── submitterMessage?: string                    (existing)
├── submitterPhone?: string                      (existing)
├── submittedFrom?: string                       (existing)
├── formName?: string                            (existing)
├── customFields?: Record<string, string>        (existing)
├── sheetsDestination?: GoogleSheetsDestination  (existing, from 016)
├── recipients?: string[]                        (existing, from 017)
├── sendEmail?: boolean                          ← NEW — omit or true = send; false = skip
└── ctaButton?: FormNotificationCtaButton        ← NEW — optional CTA override
```

---

## Resolved CTA Props (internal, computed in templates.ts)

These are not stored; they are computed per render:

```
ResolvedCta
├── ctaHref?: string    — Final href for the button (mailto: or https://...). Absent = no button rendered.
└── ctaLabel?: string   — Final label text. Absent = default label used.
```

**Resolution table**:

| `ctaButton` | `submitterEmail` | `ctaHref` | `ctaLabel` |
|-------------|------------------|-----------|------------|
| absent | present | `mailto:submitterEmail` | "Reply to {name}" or "Reply" |
| absent | absent | _(none — button omitted)_ | — |
| `{ text, action: { type: "url", url: validUrl } }` | any | `validUrl` | `text` or default |
| `{ text, action: { type: "url", url: invalid } }` | present | `mailto:submitterEmail` (fallback) | "Reply to {name}" |
| `{ text, action: { type: "mailto", email: custom } }` | any | `mailto:custom` | `text` or default |
| `{ text, action: { type: "mailto" } }` (no email) | present | `mailto:submitterEmail` | `text` or default |
| `{ text }` (no action) | present | `mailto:submitterEmail` | `text` |
| `{ action: ... }` (no text) | any | resolved from action | default label |
