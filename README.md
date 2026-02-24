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
cp .env.example .env.local
# No changes needed for local development — defaults work out of the box

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

```bash
npm run dev         # Start app server + Inngest Dev Server
npm run build       # Compile TypeScript to dist/
npm run start       # Run compiled output
npm run type-check  # Type-check without emitting
```
