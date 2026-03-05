# sol-notification-service

A multi-tenant notification service built on Inngest for durable, event-driven workflows. Sends professional HTML emails for form inquiries and weekly GA4 analytics reports — with per-client fan-out, multi-environment safety, and structured logging to Better Stack.

## Prerequisites

- Node.js 20+ (`node --version`)
- npm 9+ (`npm --version`)
- Git

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd sol-notificaiton-service
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local — minimum required: DATABASE_URL
# All other values have sensible defaults for local development

# 3. Create database tables
npm run db:setup

# 4. Seed test clients
npm run db:seed

# 5. Start the dev environment
npm run dev
```

## URLs

| Service | URL |
|---------|-----|
| App server | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Inngest Dev UI | http://localhost:8288 |
| Inngest serve handler | http://localhost:3000/api/inngest |

## Commands

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app server and Inngest Dev Server concurrently |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled output from `dist/` |
| `npm run type-check` | Type-check all source files without emitting output |
| `npm test` | Run the full unit test suite (Vitest) |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:setup` | Create all required tables (idempotent — safe to re-run) |
| `npm run db:seed` | Insert test client records (skips existing rows) |

> Both database commands read `DATABASE_URL` from `.env.local`. Run `db:setup` before `db:seed` on a fresh database.

### Email

| Command | Description |
|---------|-------------|
| `npm run email:preview` | Render a sample email in mock mode, write to `.email-preview/last.html`, and open in the browser. No real email is sent. |

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values below.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ Always | — | Neon or local PostgreSQL connection string |
| `VERCEL_ENV` | — | `development` | Set to `preview` or `production` on Vercel. Absent = local dev. |
| `EMAIL_MODE` | — | Auto-derived | Override email routing: `mock`, `test`, or `live` |
| `RESEND_API_KEY` | Production | — | Resend API key. Required when `EMAIL_MODE=live`. |
| `RESEND_FROM` | — | Example address | Verified sender address for Resend |
| `TEST_EMAIL` | Preview | — | Redirect target when `EMAIL_MODE=test` |
| `GA4_SERVICE_ACCOUNT_JSON` | Production | — | GA4 service account JSON string. Returns mock data when absent. |
| `LOGTAIL_SOURCE_TOKEN` | Production + Preview | — | Better Stack source token. Absent in dev — logs go to stdout. |

### Email modes

| Environment | Default mode | Behaviour |
|---|---|---|
| `development` | `mock` | Logs to console + writes `.email-preview/last.html`. No real sends. |
| `preview` | `test` | Redirects all emails to `TEST_EMAIL` with a `[TEST: <recipient>]` subject prefix. |
| `production` | `live` | Delivers to real client email addresses. |

## Inngest Functions

| Function | Trigger | Description |
|---|---|---|
| `send-form-notification` | `form/submitted` event | Validates payload, fetches client config, renders and sends an inquiry notification email |
| `weekly-analytics-scheduler` | Cron: Tue 09:00 UTC + `analytics/report.requested` | Fetches all active clients and fans out a per-client report event |
| `send-weekly-analytics-report` | `analytics/report.requested` event | Fetches GA4 data for the client, renders the analytics email with charts, and sends it |
| `hello-world` | `test/hello.world` event | Example stub — useful for verifying the Inngest connection |

### Triggering a function manually

1. Open the Inngest Dev UI at **http://localhost:8288**
2. Click **Send Event**
3. Use one of the event names above and provide the required payload

**Form notification** (`form/submitted`):
```json
{
  "data": {
    "clientId": "test-client",
    "submitterName": "Jane Smith",
    "submitterEmail": "jane@example.com",
    "submitterMessage": "I'd like to learn more about your services."
  }
}
```

**Analytics report** (`analytics/report.requested`):
```json
{
  "data": {
    "clientId": "test-client",
    "reportPeriod": { "preset": "last_week" },
    "scheduledAt": "2026-03-05T09:00:00Z"
  }
}
```

## Analytics Reports

Weekly analytics reports are delivered every Tuesday at 09:00 UTC. Each report includes:

- **Key metrics** — sessions, active users, new users, avg session duration
- **Daily traffic chart** — area chart showing session trend across the reporting week
- **Top pages** — table + horizontal bar chart of most-visited pages
- **Top sources** — table + bar chart of traffic sources
- **Daily breakdown** — full day-by-day metrics table

GA4 data is fetched via the `@google-analytics/data` SDK. When `GA4_SERVICE_ACCOUNT_JSON` is absent (local dev), the service returns mock data automatically — no GA4 credentials are needed to develop locally.

## Logging

All log output routes through `src/utils/logger.ts`. Never use `console.log` directly in business logic.

```ts
import { log, logError } from './utils/logger';

log('Sending email', { clientId });
logError('Failed to fetch GA4 data', error, { clientId });
```

| Environment | Transport | Output |
|---|---|---|
| `development` | pino-pretty | Colorized, human-readable stdout |
| `preview` / `production` (token set) | Better Stack (`@logtail/pino`) | Structured JSON → Better Stack UI |
| `preview` / `production` (no token) | pino/file stdout | Structured JSON → stdout (fallback, never silent) |

Set `LOGTAIL_SOURCE_TOKEN` in Vercel for Production and Preview environments. Leave it absent locally — the logger will fall back to stdout automatically.

## Project Structure

```text
src/
├── index.ts                        # HTTP server + Inngest serve handler + SIGTERM flush
├── types/
│   └── index.ts                    # All shared TypeScript types and event payload interfaces
├── lib/
│   ├── config.ts                   # Environment config singleton (single source of truth)
│   ├── db.ts                       # Neon Pool singleton + getClientById() + getAllActiveClients()
│   ├── analytics.ts                # GA4 Data API wrapper — getAnalyticsReport(), mock/live routing
│   ├── email.ts                    # Email abstraction (mock/test/live routing)
│   └── charts.ts                   # QuickChart URL builder — generateBarChart(), generateAreaChart()
├── emails/
│   ├── styles.ts                   # Design tokens (colours, typography, spacing)
│   ├── components/                 # Reusable React Email components (StatCard, FieldGroup, etc.)
│   └── templates/                  # Full email templates (sales-lead-v1, analytics-report-v1)
├── utils/
│   ├── logger.ts                   # Pino logger — exports log(), logError(), flush()
│   └── email-preview.ts            # Mock mode: writes HTML to .email-preview/last.html
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel export of all registered functions
        ├── template.ts             # Canonical workflow template — copy, do not register
        ├── hello-world.ts          # Example stub
        ├── weekly-analytics-scheduler.ts
        └── weekly-analytics-report.ts

scripts/
├── setup-db.ts                     # Idempotent table creation (npm run db:setup)
├── seed-data.ts                    # Insert test clients (npm run db:seed)
└── test-email-preview.ts           # Trigger mock email preview (npm run email:preview)

specs/                              # Feature specs, plans, research — one directory per feature
tests/
└── unit/                           # Vitest unit tests mirroring src/ structure
```
