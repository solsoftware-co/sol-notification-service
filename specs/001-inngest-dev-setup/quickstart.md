# Quickstart: Inngest Dev Server Setup

**Feature**: 001-inngest-dev-setup
**Last updated**: 2026-02-23

---

## Prerequisites

- Node.js 20+ installed (`node --version`)
- npm 9+ installed (`npm --version`)
- Git installed

---

## Step 1: Clone and Install

```bash
git clone <repo-url>
cd sol-notificaiton-service
npm install
```

Expected output: dependency tree installed with zero errors.

---

## Step 2: Configure Environment

```bash
cp .env.example .env.local
```

No values need to be changed for local development. The defaults work out of the box:
- `EMAIL_MODE=mock` — no real emails sent
- `VERCEL_ENV=development` — development mode
- No Inngest keys required for the local Dev Server

---

## Step 3: Start the Dev Environment

```bash
npm run dev
```

You should see two processes start in the same terminal:

```
[server] Server listening on http://localhost:3000
[server] Inngest serve handler ready at http://localhost:3000/api/inngest
[inngest] Inngest Dev Server running at http://localhost:8288
[inngest] Connected to http://localhost:3000/api/inngest
[inngest] Found 1 function: hello-world
```

---

## Step 4: Open the Inngest Dev UI

Navigate to **http://localhost:8288** in your browser.

You should see:
- The Inngest Dev Server dashboard
- The `notification-service` app listed in the sidebar
- The `hello-world` function listed under Functions

---

## Step 5: Send a Test Event

1. In the Inngest Dev UI, click **"Send Event"**
2. Enter event name: `test/hello.world`
3. Enter any JSON payload:
   ```json
   { "message": "Hello from the test!" }
   ```
4. Click **Send**

---

## Step 6: Verify Execution

In the Inngest Dev UI, navigate to **Runs**. You should see:

- A new run for `hello-world`
- Status: **Completed**
- Step `log-message` executed successfully
- Output visible in the step detail panel

In your terminal, the `[server]` process should log:
```
Hello from Inngest! { message: 'Hello from the test!' }
```

---

## Troubleshooting

### Port 3000 already in use

```bash
# Find the process using port 3000
lsof -i :3000

# Kill it, or change the PORT env var
PORT=3001 npm run dev
# Then update .env.local: PORT=3001
# Update Inngest Dev Server URL in npm script: -u http://localhost:3001/api/inngest
```

### Port 8288 already in use

The Inngest Dev Server will fail to start. Find and kill the conflicting process:
```bash
lsof -i :8288
```

### Inngest Dev UI shows "No functions found"

The Dev Server cannot reach the serve handler. Verify:
1. The app server is running and shows the "Inngest serve handler ready" log
2. The URL in the `dev` script matches the actual server URL (`http://localhost:3000/api/inngest`)
3. Run `curl http://localhost:3000/api/inngest` — you should get a JSON response

### `tsx` not found

```bash
npm install  # Reinstall devDependencies
```

### `inngest-cli` npx download fails (offline)

Install the CLI globally as a fallback:
```bash
npm install -g inngest-cli
```
Then replace `npx inngest-cli@latest dev` with `inngest-cli dev` in your local `npm run dev` call.

---

## Validation Checklist

Run through these to confirm the setup is complete:

- [ ] `npm install` completes with no errors
- [ ] `npm run dev` starts both processes with no errors
- [ ] http://localhost:3000/health returns `{"status":"ok"}`
- [ ] http://localhost:8288 shows the Inngest Dev UI
- [ ] `hello-world` function appears in the Functions list
- [ ] Sending a `test/hello.world` event produces a Completed run
