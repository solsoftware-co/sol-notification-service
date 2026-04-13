# Data Model: Flexible Form Notification Fields (015)

**Date**: 2026-04-11  
**Scope**: Type-level changes only — no database schema changes required.

---

## Updated Entity: `FormSubmittedPayload`

The `FormSubmittedPayload` interface in `src/types/index.ts` is the only changed entity.

### Before

```
FormSubmittedPayload
├── clientId: string          [REQUIRED]
├── submitterName: string     [REQUIRED]
├── submitterEmail: string    [REQUIRED]
├── submitterMessage: string  [REQUIRED]
└── formId?: string           [optional]
```

### After

```
FormSubmittedPayload
├── clientId: string                        [REQUIRED — only required field]
├── submitterName?: string                  [optional — was required]
├── submitterEmail?: string                 [optional — was required]
├── submitterMessage?: string               [optional — was required]
├── submitterPhone?: string                 [NEW — optional]
├── submittedFrom?: string                  [NEW — optional, e.g. "/contact"]
├── formName?: string                       [NEW — optional, human-readable form label]
├── customFields?: Record<string, string>   [NEW — optional, arbitrary key-value pairs]
└── formId?: string                         [DEPRECATED — silently ignored; kept for backward compat]
```

### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | `string` | Yes | Identifies the client whose notification recipients receive the email. |
| `submitterName` | `string?` | No | Full name of the form submitter. |
| `submitterEmail` | `string?` | No | Email address of the form submitter. When present, the reply CTA button is shown. |
| `submitterPhone` | `string?` | No | Phone number of the form submitter. |
| `submitterMessage` | `string?` | No | Free-text message or comment from the submitter. |
| `submittedFrom` | `string?` | No | URL path of the page the form was submitted from (e.g. `/contact`). |
| `formName` | `string?` | No | Human-readable name of the form (e.g. `"Contact Form"`, `"Quote Request"`). Used in the email subject line. |
| `customFields` | `Record<string, string>?` | No | Arbitrary key-value pairs for form-specific data not covered by standard fields. Keys are field labels; values are plain-text strings. |
| `formId` | `string?` | No | **Deprecated.** Previously used as a form identifier. Replaced by `formName`. Silently ignored — not rendered in emails or logs. |

### Validation Rules

- `clientId` must be a non-empty string. Workflow throws with `"Missing required field: clientId"` if absent or empty.
- All other fields: no format validation at the service level. Format validation (e.g., email syntax, phone format) is the caller's responsibility.
- `customFields` with an empty object (`{}`) is treated identically to the field being absent.
- `customFields` values are rendered as plain text. React JSX escapes HTML characters by default.

### Backward Compatibility

Existing callers that send `{ clientId, submitterName, submitterEmail, submitterMessage }` continue to work without modification. All previously required fields are accepted and rendered exactly as before — they are simply no longer enforced as required.

---

## No Database Changes

`notification_logs.metadata` already stores form data as a `JSONB` blob. The updated payload shape is serialized into `metadata.formData` as-is. The schema is schema-less for this column, so new fields are captured automatically.
