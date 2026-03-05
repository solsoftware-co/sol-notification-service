# Quickstart: Structured Logging with Better Stack

**Feature**: 008-structured-logging

This guide walks through setting up Better Stack for the first time and verifying the logging pipeline end-to-end.

---

## 1. Create a Better Stack Account

1. Go to [betterstack.com](https://betterstack.com) and sign up (GitHub or Google OAuth; no credit card required).
2. Complete onboarding — you'll land on the Better Stack dashboard.

---

## 2. Create a Log Source

Better Stack uses "Sources" instead of datasets. Each source has its own ingest token.

1. In the left sidebar, go to **Logs** → **Sources**.
2. Click **Connect source**.
3. Select **HTTP** as the platform (Pino sends logs over HTTP).
4. Name it `sol-notification-service`.
5. Click **Create source**.
6. **Copy the Source Token immediately** — this becomes your `LOGTAIL_SOURCE_TOKEN`.

---

## 3. Add Environment Variables

**Local development (`.env.local`):**

```
# Better Stack — leave absent in local dev; logger falls back to stdout JSON
# LOGTAIL_SOURCE_TOKEN=
```

**Production / Preview (Vercel dashboard → Settings → Environment Variables):**

```
LOGTAIL_SOURCE_TOKEN=<your-source-token>
```

Set `LOGTAIL_SOURCE_TOKEN` for both **Production** and **Preview** environments. Do not set it for the **Development** environment — the logger automatically falls back to stdout when it is absent (via `pino/file` with `destination: 1`), so logs are never silently dropped.

---

## 4. Install Dependencies

```bash
npm install pino @logtail/pino
npm install --save-dev pino-pretty
```

---

## 5. Verify Locally (stdout only)

Start the dev server:

```bash
npm run dev
```

Trigger a workflow (e.g., via the Inngest Dev UI at `http://localhost:8288`). You should see human-readable, colorized log output in the terminal:

```
[14:00:01.123] INFO (sol-notification-service): Starting weekly analytics report
    env: "development"
    clientId: "test-client"
```

---

## 6. Verify in Production / Preview

After deploying with `LOGTAIL_SOURCE_TOKEN` set:

1. Trigger a workflow run via the Inngest dashboard or a real event.
2. Open [logs.betterstack.com](https://logs.betterstack.com) → select your source → **Live tail** or **Search**.
3. Within ~10 seconds, log entries should appear. Try filtering by field using SQL:
   ```sql
   WHERE clientId = 'your-client-id'
   ```
4. Verify each entry contains `level`, `time`, `env`, `service`, `clientId`, and `msg`.

**Filter by environment** (production vs preview in one source):
```sql
WHERE env = 'production'
WHERE env = 'preview'
```

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No logs in Better Stack | `LOGTAIL_SOURCE_TOKEN` not set in the deployment environment | Add the var in Vercel → Settings → Environment Variables for Production and Preview |
| Logs appear as raw JSON in terminal locally | `config.env` is resolving to non-`development` locally | Check `.env.local` — `VERCEL_ENV` should be absent or set to `development` |
| `Cannot find module 'pino-pretty'` error | `pino-pretty` is being required in a non-dev environment | Verify the transport condition uses `config.env === 'development'`, not `isProd` |
| Log entries missing `clientId` | The workflow step isn't passing `{ clientId }` to `log()` | Confirm all `step.run` callbacks pass `context` with `clientId` |
| Logs visible in terminal but not Better Stack | `LOGTAIL_SOURCE_TOKEN` present but wrong value | Regenerate token in Better Stack → Sources → your source → Settings |
