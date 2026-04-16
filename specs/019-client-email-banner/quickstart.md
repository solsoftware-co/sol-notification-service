# Quickstart: Testing Per-Client Email Banner

**Feature**: 019-client-email-banner

---

## Prerequisites

- `npm run dev` running (app server + Inngest Dev Server)
- A client record exists in the dev DB (run `npm run db:seed` if needed)

---

## Step 1: Add Banner Config to a Client

Update the `client-acme` seed record (or any existing client) directly in the DB or via a psql/Neon console query:

```sql
UPDATE clients
SET settings = settings || '{"banner": {"imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png", "height": 60, "width": 280}}'::jsonb
WHERE id = 'client-acme';
```

---

## Step 2: Trigger a Form Notification Email

```bash
npm run email:preview
```

Or send the event via the Inngest Dev UI at `http://localhost:8288`:

```json
{
  "name": "notification/form.submitted",
  "data": {
    "clientId": "client-acme",
    "submitterName": "Test User",
    "submitterEmail": "test@example.com"
  }
}
```

---

## Step 3: Verify the Email

Open `.email-preview/last.html` in a browser (mock mode) and confirm:
- The banner shows the custom image (not the default Sol Software logo)
- The image renders at the configured dimensions (60px tall, 280px wide)

---

## Step 4: Test Fallback (Unreachable URL)

```sql
UPDATE clients
SET settings = settings || '{"banner": {"imageUrl": "https://this-url-does-not-exist.example.com/logo.png"}}'::jsonb
WHERE id = 'client-acme';
```

Trigger the email again. Confirm:
- The email still renders and sends (no error)
- The banner falls back to the default Sol Software logo
- A warning log is emitted (visible in the Inngest Dev Server or terminal)

---

## Step 5: Test No Config (Existing Clients)

```sql
UPDATE clients
SET settings = settings - 'banner'
WHERE id = 'client-acme';
```

Trigger the email again. Confirm the banner is identical to the current default behaviour — zero visual regression.

---

## Step 6: Test Analytics Report Banner

Send the analytics report event via the Inngest Dev UI:

```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "client-acme",
    "reportPeriod": { "preset": "last_week" },
    "scheduledAt": "2026-04-16T09:00:00Z"
  }
}
```

Re-add the banner config from Step 1 and confirm the analytics report email also uses the custom banner.
