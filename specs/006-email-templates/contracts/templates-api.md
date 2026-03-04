# Contract: `src/lib/templates.ts`

**Feature**: 006-email-templates
**Date**: 2026-03-03
**Contract type**: Internal module API — TypeScript function signatures

This file defines the public interface of `src/lib/templates.ts`. Workflow functions depend on this contract to generate email HTML without constructing templates directly.

---

## Exported Functions

### `renderFormNotificationEmail`

Converts a form submission event payload and client record into a complete, renderable inquiry email.

```typescript
export async function renderFormNotificationEmail(
  payload: FormSubmittedPayload,
  client: ClientRow
): Promise<EmailRenderResult>
```

**Inputs**:
- `payload` — the `form/submitted` event payload (name, email, message, optional formId)
- `client` — the resolved client record from the database (name, email)

**Output** (`EmailRenderResult`):
- `subject` — formatted as `"New inquiry — ${client.name}"` or `"New form submission: ${payload.formId}"` when formId is present
- `html` — fully rendered HTML string from `sales-lead-v1.tsx` with all optional fields omitted where absent
- `attachments` — array containing the banner logo CID attachment (read from `assets/banner_image.png`)

**Side effects**: Reads banner image file from disk. No network calls.

**Error conditions**:
- Throws if the banner image asset cannot be read from disk (file missing)

---

### `renderAnalyticsReportEmail`

Converts an analytics report and client record into a complete, renderable weekly analytics email.

```typescript
export async function renderAnalyticsReportEmail(
  report: AnalyticsReport,
  client: ClientRow,
  period: ResolvedPeriod
): Promise<EmailRenderResult>
```

**Inputs**:
- `report` — the resolved `AnalyticsReport` from `getAnalyticsReport()`
- `client` — the resolved client record from the database
- `period` — the resolved date range with human-readable label

**Output** (`EmailRenderResult`):
- `subject` — `"Your analytics report — ${period.label}"`
- `previewText` — `"${client.name} — ${period.label}: ${sessions} sessions"`
- `html` — fully rendered HTML string from `analytics-report-v1.tsx` with all available data sections populated
- `attachments` — array containing the banner logo CID attachment

**Side effects**: Reads banner image file from disk. No network calls.

**Error conditions**:
- Throws if the banner image asset cannot be read from disk

---

## `EmailRenderResult` type

```typescript
interface EmailRenderResult {
  subject: string
  html: string
  previewText?: string
  attachments: EmailAttachment[]
}
```

---

## `EmailAttachment` type

```typescript
interface EmailAttachment {
  filename: string
  content: Buffer | string
  headers?: {
    'Content-ID': string
    'Content-Disposition'?: string
  }
}
```

---

## Usage Pattern (workflow function)

```typescript
// Inside step.run("send-email", async () => { ... })
const rendered = await renderFormNotificationEmail(payload, client);
return sendEmail({
  to: client.email,
  subject: rendered.subject,
  html: rendered.html,
  attachments: rendered.attachments,
});
```

---

## `sendEmail` signature extension

`EmailRequest` is extended with an optional `attachments` field:

```typescript
interface EmailRequest {
  to: string
  subject: string
  html: string
  from?: string
  attachments?: EmailAttachment[]    // new optional field
}
```

In **mock** mode: attachments are ignored (no file I/O, no Resend call).
In **test** and **live** modes: attachments are forwarded to the Resend `emails.send()` call.

---

## Banner Asset

The banner image is expected at: `assets/banner_image.png` (relative to project root).

The `templates.ts` functions read this file once per render call using `fs.readFile`. The CID reference in the template (`cid:banner_image.png`) must match the `Content-ID` header value passed in the attachment (`<banner_image.png>`).
