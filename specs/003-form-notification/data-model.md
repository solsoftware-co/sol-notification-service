# Data Model: Form Submission Notification

**Feature Branch**: `003-form-notification`
**Date**: 2026-02-27

---

## No New Database Tables

This feature introduces no new database tables. It reads from the existing `clients` table via `getClientById()` from 002.

---

## New Type: FormSubmittedPayload

Added to `src/types/index.ts` — extends `BaseEventPayload` (which already requires `clientId`).

```typescript
export interface FormSubmittedPayload extends BaseEventPayload {
  submitterName: string;
  submitterEmail: string;
  submitterMessage: string;
  formId?: string;       // optional; defaults to "Unknown form" in the email
}
```

**Validation rules** (enforced at runtime in the first workflow step):
- `clientId`: non-empty string (inherited from BaseEventPayload)
- `submitterName`: non-empty string
- `submitterEmail`: non-empty string (no format validation — used as display text only, not as a send target)
- `submitterMessage`: non-empty string
- `formId`: any string or undefined — never causes a workflow failure

---

## Inngest Event Contract

**Event name**: `form/submitted`

**Full event envelope** (as sent to Inngest):

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "submitterMessage": "Hi, I'd like to get a quote for your services.",
    "formId": "contact"
  }
}
```

**Minimal valid payload** (formId omitted):

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "client-acme",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "submitterMessage": "Hello!"
  }
}
```

---

## Notification Email Structure

The email sent to the client contains:

| Field | Source | Example |
|-------|--------|---------|
| To | `client.email` from DB | `owner@acme.com` |
| Subject | Derived from formId | `New form submission: contact` |
| Submitter name | `data.submitterName` | Jane Smith |
| Submitter email | `data.submitterEmail` | `jane@example.com` |
| Message | `data.submitterMessage` | Hi, I'd like a quote... |
| Form | `data.formId ?? "Unknown form"` | contact |
| Received at | `new Date().toISOString()` at workflow start | 2026-02-27T14:30:00.000Z |
