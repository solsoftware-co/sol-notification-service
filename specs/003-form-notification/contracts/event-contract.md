# Event Contract: form/submitted

**Feature Branch**: `003-form-notification`
**Date**: 2026-02-27

This is the public event contract for triggering the form submission notification workflow.
Any external system (website, CMS, webhook handler, Zapier, curl) can trigger this workflow
by sending a conforming event to the Inngest serve endpoint.

---

## Event

| Property | Value |
|----------|-------|
| **Event name** | `form/submitted` |
| **Workflow triggered** | `send-form-notification` |
| **Inngest function ID** | `send-form-notification` |

---

## Payload Schema

```typescript
{
  name: "form/submitted",
  data: {
    clientId:         string,   // required — must match an active client in the database
    submitterName:    string,   // required — display name of the person who submitted the form
    submitterEmail:   string,   // required — email address of the submitter (informational only)
    submitterMessage: string,   // required — the message or enquiry body
    formId?:          string,   // optional — identifies which form was submitted (e.g. "contact", "quote-request")
  }
}
```

---

## Triggering from the Inngest Dev UI (local testing)

1. Open `http://localhost:8288`
2. Click **Send Event**
3. Use this payload:

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

4. Click **Send** — the run appears under **Runs** within seconds

---

## Triggering via CLI (local testing)

```bash
npm run test:form
```

Or manually with curl (requires `INNGEST_EVENT_KEY` — use `local` for dev server):

```bash
curl -X POST http://localhost:8288/e/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "form/submitted",
    "data": {
      "clientId": "client-acme",
      "submitterName": "Jane Smith",
      "submitterEmail": "jane@example.com",
      "submitterMessage": "Hi, I would like a quote.",
      "formId": "contact"
    }
  }'
```

---

## Error Responses

The workflow fails immediately (visible in Inngest dashboard) if:

| Condition | Error message |
|-----------|---------------|
| `clientId` missing | `Missing required field: clientId` |
| `submitterName` missing | `Missing required field: submitterName` |
| `submitterEmail` missing | `Missing required field: submitterEmail` |
| `submitterMessage` missing | `Missing required field: submitterMessage` |
| `clientId` not in database | `Client not found: <clientId>` |
| `clientId` matches inactive client | `Client inactive: <clientId>` |

---

## Stability

This event contract is stable for the PoC. Breaking changes (renamed fields, new required fields) require a version bump and migration plan.
