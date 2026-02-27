# Quickstart: Form Submission Notification

**Feature Branch**: `003-form-notification`
**Date**: 2026-02-27

---

## Prerequisites

- Feature 002 complete and working (`npm run db:setup && npm run db:seed` already run)
- `.env.local` configured with `DATABASE_URL`
- `npm run dev` starts without errors

---

## Testing the Workflow

### Option A: CLI (fastest)

```bash
npm run test:form
```

A sample `form/submitted` event is sent to the local Inngest Dev Server for `client-acme`.
Watch the terminal for the mock email log, and open the Inngest Dev UI at
`http://localhost:8288` to see the run steps.

### Option B: Inngest Dev UI

1. Start the service: `npm run dev`
2. Open `http://localhost:8288`
3. Click **Send Event** and paste:

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
5. Click the run to see each step: `validate-payload` → `fetch-client-config` → `send-email` → `log-result`

---

## Verifying Email Output

In development (mock mode), the rendered email HTML opens automatically in your browser.
You will also see a log entry in the terminal:

```
[development] [clientId=client-acme] Workflow started { eventName: 'form/submitted' }
[development] [mock] Would send to: test-acme@example.com | Subject: New form submission: contact | Body length: ...
[development] [clientId=client-acme] Workflow completed { mode: 'mock', outcome: 'logged' }
```

---

## Testing Error Cases

**Unknown client**:
```json
{ "name": "form/submitted", "data": { "clientId": "client-unknown", "submitterName": "X", "submitterEmail": "x@x.com", "submitterMessage": "test" } }
```
Expected: run fails with `Client not found: client-unknown`

**Missing required field**:
```json
{ "name": "form/submitted", "data": { "clientId": "client-acme", "submitterName": "Jane" } }
```
Expected: run fails with `Missing required field: submitterEmail`

**Without formId** (optional field):
```json
{ "name": "form/submitted", "data": { "clientId": "client-acme", "submitterName": "Jane", "submitterEmail": "jane@example.com", "submitterMessage": "Hello!" } }
```
Expected: run succeeds, email subject reads `New form submission: Unknown form`
