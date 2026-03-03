# Quickstart: Weekly Analytics Report (005)

**Branch**: `005-weekly-analytics-report`

How to run and test the weekly analytics report workflow end-to-end in local development.

The cron fires every **Tuesday at 09:00 UTC**. The default report covers the complete **Mon–Sun calendar week** that ended two days prior (`last_week` preset).

---

## Prerequisites

- `npm run dev` running (app server + Inngest Dev Server)
- `.env.local` configured with at least `DATABASE_URL`
- At least one client seeded with a `ga4_property_id` (or rely on mock mode if no GA4 credentials)

---

## Environment Variables

Add to `.env.local`:

```bash
# Required: existing variables
DATABASE_URL=...
EMAIL_MODE=mock          # Use mock to avoid real email sends during testing

# New for this feature (optional in dev — mock analytics data used if absent)
GA4_SERVICE_ACCOUNT_JSON='{...}'   # Paste your service account JSON as a single-line string
                                   # Leave unset to use mock analytics data locally
```

In production (Vercel), set:
```bash
GA4_SERVICE_ACCOUNT_JSON='{...}'   # Required — app will throw on startup if absent in production
```

---

## Test: Mock Mode (no GA4 credentials)

With `GA4_SERVICE_ACCOUNT_JSON` unset, the analytics module returns synthetic data. This is the fastest way to test the full email pipeline locally.

1. Open the Inngest Dev UI at `http://localhost:8288`
2. Click **Send Event**
3. Enter event name: `analytics/weekly.scheduled`
4. Enter payload: `{}`
5. Click **Send**
6. Watch the `weekly-analytics-scheduler` run fan out events
7. Watch the `send-weekly-analytics-report` run per client — email logged to console with mock metrics

---

## Test: Real GA4 Data

With a valid `GA4_SERVICE_ACCOUNT_JSON` and a client seeded with a real `ga4_property_id`:

1. Update the client's `ga4_property_id` in the database:
   ```sql
   UPDATE clients SET ga4_property_id = '123456789' WHERE id = 'your-client-id';
   ```
2. Send `analytics/weekly.scheduled` from the Dev UI (as above)
3. The `fetch-analytics-data` step will call the GA4 Data API and return real metrics
4. The email will contain actual sessions, users, pageviews, and top pages from the past 7 days

---

## Test: Per-Client Trigger Directly (any period preset)

Send `analytics/report.requested` directly to test a single client with any period preset — no need to go through the scheduler.

**Last week (default):**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "your-client-id",
    "reportPeriod": { "preset": "last_week" },
    "scheduledAt": "2026-02-24T09:00:00.000Z"
  }
}
```

**Last month:**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "your-client-id",
    "reportPeriod": { "preset": "last_month" },
    "scheduledAt": "2026-02-28T10:00:00.000Z"
  }
}
```

**Custom date range:**
```json
{
  "name": "analytics/report.requested",
  "data": {
    "clientId": "your-client-id",
    "reportPeriod": {
      "preset": "custom",
      "start": "2026-01-01",
      "end": "2026-01-31"
    },
    "scheduledAt": "2026-02-28T10:00:00.000Z"
  }
}
```

**Available presets**: `last_week`, `last_month`, `last_30_days`, `last_90_days`, `custom`

---

## Test: Non-Production Safety Filter

To verify the test-client filter works:

1. Ensure your database has at least one client with `email LIKE '%test%'` and one without
2. Set `EMAIL_MODE=test` and `TEST_EMAIL=you@example.com` in `.env.local`
3. Send `analytics/weekly.scheduled` from the Dev UI
4. Verify: only the test client receives a report (redirected to `TEST_EMAIL`)
5. Verify: clients without `test` in their email are excluded from the fan-out

---

## Seeding a Test Client with GA4 Property

If you need a new test client with GA4 configured, run the seed script (update as needed):

```bash
npm run db:seed
```

Or manually insert:
```sql
INSERT INTO clients (id, name, email, ga4_property_id, active)
VALUES ('client-test-001', 'Test Client', 'test@example.com', '123456789', TRUE);
```

---

## What to Expect

| Scenario | Scheduler run | Worker runs | Email |
|----------|--------------|-------------|-------|
| Mock mode, 1 test client | 1 run, 1 event dispatched | 1 run, success | Logged to console |
| Mock mode, no active clients | 1 run, 0 events | none | none |
| Real GA4, valid property | 1 run per client | N runs | Delivered (or logged) |
| Missing `ga4_property_id` | runs normally | 1 failed run | none |
| Invalid property ID | runs normally | 1 failed run (after 3 retries) | none |
