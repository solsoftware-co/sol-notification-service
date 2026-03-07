# Quickstart: Production Deployment End-to-End Validation

**Feature**: 009-vercel-prod-deploy
**Date**: 2026-03-05

This guide walks through the complete deployment sequence from zero to a live, fully verified production environment.

---

## Prerequisites

- [ ] GitHub repo connected to a Vercel account (Hobby plan or higher)
- [ ] Neon account with a production database branch
- [ ] Resend account with a verified sender domain
- [ ] Inngest Cloud account (free tier)
- [ ] Better Stack account with a Source token from spec 008
- [ ] Google Cloud service account with GA4 read access

---

## Step 1: Initialise the Production Database

```bash
# Export the production Neon connection string
export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

# Create tables (idempotent — safe to re-run)
npm run db:setup

# Seed initial client data
npm run db:seed
```

Verify in Neon dashboard that the `clients` table exists and contains rows.

---

## Step 2: Get Inngest Cloud Credentials

1. Go to [app.inngest.com](https://app.inngest.com) → **Create new app**
2. Name it `sol-notification-service` (or similar)
3. Copy **Signing Key** → save as `INNGEST_SIGNING_KEY`
4. Go to **Manage → Event keys** → copy the default key → save as `INNGEST_EVENT_KEY`

You will set these in Vercel in the next step.

---

## Step 3: Set Environment Variables in Vercel

Go to **Vercel dashboard → Project → Settings → Environment Variables**.

Set the following for the **Production** environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon production branch connection string |
| `RESEND_API_KEY` | Resend live API key |
| `RESEND_FROM` | `Your Name <notifications@yourdomain.com>` |
| `GA4_SERVICE_ACCOUNT_JSON` | Full service account JSON (single-line string) |
| `LOGTAIL_SOURCE_TOKEN` | Better Stack HTTP source token |
| `INNGEST_SIGNING_KEY` | From Step 2 |
| `INNGEST_EVENT_KEY` | From Step 2 |

**Do NOT set `VERCEL_ENV`** — Vercel injects this automatically.

Also set `LOGTAIL_SOURCE_TOKEN` for the **Preview** environment (same token is fine).

---

## Step 4: Deploy to Vercel

```bash
# Merge feature branch to main — Vercel auto-deploys on push to main
git checkout main
git merge 009-vercel-prod-deploy
git push origin main
```

Watch the Vercel dashboard for the deployment to complete (typically 60–90 seconds).

---

## Step 5: Register Serve Endpoint in Inngest Cloud

1. Get your production URL from the Vercel dashboard (e.g., `https://sol-notification-service.vercel.app`)
2. In Inngest Cloud → **Your app → Sync app**
3. Enter the serve URL: `https://sol-notification-service.vercel.app/api/inngest`
4. Click **Sync** — Inngest will discover all registered functions

Verify that all 4 functions appear in the Inngest Cloud dashboard:
- `send-form-notification`
- `weekly-analytics-scheduler`
- `send-analytics-report`
- `hello-world`

---

## Step 6: Validate Health Check

```bash
curl https://sol-notification-service.vercel.app/api/health
# Expected: {"status":"ok"}
```

---

## Step 7: Trigger a Form Notification (E2E Test)

In Inngest Cloud dashboard → **Send Event**:

```json
{
  "name": "form/submitted",
  "data": {
    "clientId": "test-client",
    "submitterName": "QA Test",
    "submitterEmail": "qa@example.com",
    "submitterMessage": "Production smoke test"
  }
}
```

Verify:
- [ ] Run appears in Inngest Cloud with all steps green
- [ ] Email delivered to the client's configured address (check Resend dashboard → Logs)
- [ ] Log entry appears in Better Stack within 10 seconds, filterable by `env = 'production'`

---

## Step 8: Trigger an Analytics Report (E2E Test)

In Inngest Cloud dashboard → **Send Event**:

```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "test-client",
    "reportPeriod": { "preset": "last_month" },
    "scheduledAt": "2026-03-05T10:00:00.000Z"
  }
}
```

Verify:
- [ ] Run appears in Inngest Cloud with all steps green
- [ ] Email delivered with real GA4 data (non-zero session counts)
- [ ] Log entry appears in Better Stack with `clientId` field

---

## Step 9: Validate Scheduled Cron (Next Tuesday)

After the next Tuesday 09:00 UTC, verify in Inngest Cloud:
- [ ] `weekly-analytics-scheduler` fired automatically
- [ ] One `analytics/report.requested` event fanned out per active client
- [ ] Each per-client `send-analytics-report` run completed successfully

---

## Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| `400 Bad Request` on `/api/inngest` | Missing or wrong `INNGEST_SIGNING_KEY` | Copy key from Inngest Cloud and redeploy |
| Email logs show `[mock]` prefix | `EMAIL_MODE` is overriding production mode | Remove `EMAIL_MODE` env var from Vercel — let `VERCEL_ENV` drive it |
| GA4 data shows mock values | `GA4_SERVICE_ACCOUNT_JSON` missing or malformed | Paste full JSON as a single escaped string; verify no line breaks |
| Logs not appearing in Better Stack | `LOGTAIL_SOURCE_TOKEN` missing | Set token in Vercel → Production env vars and redeploy |
| Functions not discovered by Inngest Cloud | Sync URL is wrong | Ensure URL ends in `/api/inngest` exactly |
