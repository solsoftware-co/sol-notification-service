# Contract: CTA Button Resolution

**Module**: `src/lib/templates.ts` — `resolveCta()` helper (called inside `renderFormNotificationEmail`)  
**Type**: Internal pure function

---

## Signature

```typescript
function resolveCta(
  ctaButton: FormNotificationCtaButton | undefined,
  submitterEmail: string | undefined,
  submitterName: string | undefined,
): { ctaHref?: string; ctaLabel?: string }
```

---

## Resolution Algorithm

```
defaultLabel = submitterName ? `Reply to ${submitterName}` : "Reply"
defaultHref  = submitterEmail ? `mailto:${submitterEmail}` : undefined

if ctaButton is absent:
  → return { ctaHref: defaultHref, ctaLabel: defaultLabel }

resolve action:
  if ctaButton.action is absent:
    → actionHref = defaultHref

  else if ctaButton.action.type === "url":
    url = ctaButton.action.url
    if url is valid (non-empty, starts with http:// or https://):
      → actionHref = url
    else:
      → log warning; actionHref = defaultHref  (silent fallback)

  else if ctaButton.action.type === "mailto":
    email = ctaButton.action.email ?? submitterEmail
    → actionHref = email ? `mailto:${email}` : undefined

  else (unrecognised type):
    → log warning; actionHref = defaultHref  (silent fallback)

resolve label:
  ctaLabel = (ctaButton.text && ctaButton.text.trim().length > 0)
             ? ctaButton.text.trim()
             : defaultLabel

return { ctaHref: actionHref, ctaLabel: actionHref ? ctaLabel : undefined }
```

---

## Invariants

- **Never throws**: All invalid inputs are logged as warnings and fall back silently.
- **Button suppressed when no href**: If neither the payload nor `submitterEmail` yields a valid href, both `ctaHref` and `ctaLabel` are `undefined` — the template omits the button.
- **Pure function**: No side effects except `logError()` warnings; testable without mocking Inngest or the email provider.

---

## Template Props Contract (`SalesLeadV1Email`)

New props added to `InquiryEmailProps`:

```typescript
ctaHref?:  string   // resolved href — button renders if present
ctaLabel?: string   // resolved label — used when ctaHref is present
```

The existing `customerEmail`-based button logic is replaced by these two props. The template renders:

```tsx
{ctaHref && (
  <CTAButton
    href={ctaHref}
    label={ctaLabel ?? "Reply"}
    variant="black"
    size="lg"
    radius="rounded"
  />
)}
```

---

## Test Requirements

| Scenario | `ctaHref` | `ctaLabel` |
|----------|-----------|------------|
| No `ctaButton`, `submitterEmail` present | `mailto:email` | "Reply to {name}" or "Reply" |
| No `ctaButton`, no `submitterEmail` | `undefined` | `undefined` |
| `action.type="url"`, valid URL | the URL | custom text or default |
| `action.type="url"`, missing URL | `mailto:submitterEmail` (fallback) | default |
| `action.type="url"`, invalid URL (no protocol) | `mailto:submitterEmail` (fallback) | default |
| `action.type="mailto"`, `email` provided | `mailto:customEmail` | custom text or default |
| `action.type="mailto"`, no `email`, `submitterEmail` present | `mailto:submitterEmail` | custom text or default |
| `action.type="mailto"`, no `email`, no `submitterEmail` | `undefined` | `undefined` |
| `ctaButton.text` only (no `action`) | `mailto:submitterEmail` | custom text |
| Unrecognised `action.type` | `mailto:submitterEmail` (fallback) | default |
| Empty `ctaButton.text` string | fallback href | default label |
