# Quickstart: Core Shared Infrastructure

**Feature Branch**: `002-core-infrastructure`
**Date**: 2026-02-25

---

## Prerequisites

- Node.js 20+
- A Neon database (free tier: https://neon.tech) — or a local PostgreSQL instance
- A Resend account (free tier: https://resend.com) with a verified sender domain
- Feature 001 (Inngest dev setup) complete — `npm run dev` works

---

## Step 1: Install the Database Dependency

```bash
npm install @neondatabase/serverless
```

---

## Step 2: Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# Environment (omit for development, set to 'preview' or 'production' for other envs)
# VERCEL_ENV=production

# Email mode override (auto-derived from VERCEL_ENV if not set)
# EMAIL_MODE=mock

# Required when EMAIL_MODE=test
# TEST_EMAIL=your-test-inbox@example.com

# Required when EMAIL_MODE=live
# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Sender address (must be a Resend-verified domain)
RESEND_FROM=Notifications <notifications@yourdomain.com>

# Neon or local PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

**Minimum config for local development** (mock email mode):
```bash
DATABASE_URL=postgresql://...your-neon-dev-branch-url...
RESEND_FROM=Notifications <notifications@yourdomain.com>
```

No `RESEND_API_KEY` needed in development — emails are logged to the console only.

---

## Step 3: Set Up the Database

```bash
npm run db:setup
```

Expected output:
```
[db] Connected
[db] Created table: clients
[db] Created table: notification_logs
[db] Setup complete
```

Running this command again on an already-configured database is safe — it will not destroy existing data.

---

## Step 4: Seed Test Clients

```bash
npm run db:seed
```

Expected output:
```
[db] Seeded client: client-acme (Acme Corp)
[db] Seeded client: client-globex (Globex Inc)
[db] Seed complete — 2 clients available
```

---

## Step 5: Start the Service

```bash
npm run dev
```

Expected output:
```
[server] Server listening on http://localhost:3000
[server] Inngest serve handler ready at http://localhost:3000/api/inngest
[development] Config loaded: { emailMode: 'mock', env: 'development' }
[db] Connection ok
[inngest] Inngest Dev Server running at http://localhost:8288
```

---

## Verifying Email Modes

### Mock Mode (default in development)

Trigger any workflow that calls `sendEmail`. In the terminal you will see:
```
[development] [mock] Would send to: client@example.com | Subject: Hello | Body length: 42 chars
```
No email is sent.

### Test Mode

Set `EMAIL_MODE=test` and `TEST_EMAIL=your@inbox.com` in `.env.local`, restart, then trigger a workflow. An email arrives at `your@inbox.com` with subject `[TEST: client@example.com] Hello`.

### Live Mode

Set `EMAIL_MODE=live` and `RESEND_API_KEY=re_...`, restart, then trigger a workflow. The email is delivered to the real recipient.

---

## Creating a New Workflow from the Template

1. Copy `src/inngest/functions/template.ts` to a new file, e.g. `src/inngest/functions/my-workflow.ts`
2. Change the event name in `trigger`
3. Replace the placeholder business logic
4. Add the new function to `src/inngest/functions/index.ts`
5. Run `npm run type-check` — zero errors expected

The template already handles: config access, client lookup, email send, and step naming conventions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `DATABASE_URL environment variable is not set` | Missing env var | Add `DATABASE_URL` to `.env.local` |
| `EMAIL_MODE=live requires RESEND_API_KEY` | Missing API key | Add `RESEND_API_KEY` to `.env.local` |
| `EMAIL_MODE=test requires TEST_EMAIL` | Missing test address | Add `TEST_EMAIL` to `.env.local` |
| `Client not found: <id>` | Seed not run or wrong ID | Run `npm run db:seed` |
| `Client inactive: <id>` | Client marked inactive | Update `active=true` in DB |
| Resend error `invalid_from_address` | Sender domain not verified | Verify domain in Resend dashboard |
