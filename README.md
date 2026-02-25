# sol-notification-service

A notification service built on Inngest for durable, event-driven workflows.

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
# Set DATABASE_URL to your Neon dev branch connection string
# All other values have sensible defaults for local development

# 3. Start the dev environment
npm run dev
```

## URLs

| Service | URL |
|---------|-----|
| App server | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Inngest Dev UI | http://localhost:8288 |
| Inngest serve handler | http://localhost:3000/api/inngest |

## Testing a Function

1. Open the Inngest Dev UI at **http://localhost:8288**
2. Click **Send Event**
3. Enter event name: `test/hello.world`
4. Enter payload:
   ```json
   { "message": "Hello from the test!" }
   ```
5. Click **Send** — the run should appear in **Runs** with status **Completed**

## Commands

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app server and Inngest Dev Server concurrently |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled output from `dist/` |
| `npm run type-check` | Type-check all source files without emitting output |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:setup` | Create all required tables in the database (idempotent — safe to re-run) |
| `npm run db:seed` | Insert test client records into the database (skips existing rows) |

> Both database commands read `DATABASE_URL` from `.env.local`. Run `db:setup` before `db:seed` on a fresh database.

### Email

| Command | Description |
|---------|-------------|
| `npm run email:preview` | Send a sample email in mock mode — writes rendered HTML to `.email-preview/last.html` and opens it in the browser. No real email is sent. |
