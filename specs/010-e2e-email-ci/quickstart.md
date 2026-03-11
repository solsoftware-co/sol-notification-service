# Quickstart: Automated End-to-End Email Testing in CI

**Feature**: `010-e2e-email-ci`

This guide covers the one-time setup required to get the automated e2e email pipeline running, and how to run tests manually against a Preview deployment.

---

## Prerequisites

- Vercel project already deployed and connected to GitHub (feature 009)
- Inngest staging environment configured with the Vercel integration (feature 009)
- Neon staging database branch with a seeded test client (feature 009 + `npm run db:seed`)
- `TEST_EMAIL` set to a Mailtrap inbox address in Vercel Preview environment variables (step 2 below)

---

## One-Time Setup

### 1. Create a Mailtrap account and inbox

1. Sign up at [mailtrap.io](https://mailtrap.io) (free tier)
2. Go to **Email Testing → Inboxes** → create an inbox (e.g. `sol-notification-ci`)
3. From the inbox settings, note:
   - **Account ID** — visible in the Mailtrap URL: `mailtrap.io/inboxes/{inboxId}`
   - **Inbox ID** — same URL
   - **API Token** — go to **API Tokens** → create a token with `Inbox read/write` scope

### 2. Set `TEST_EMAIL` in Vercel (Preview environment)

The Mailtrap inbox does not have a real email address for receiving SMTP — it receives via the Resend → Mailtrap API path. Set `TEST_EMAIL` in Vercel's Preview environment to any address you control (e.g. `ci-test@yourdomain.com`). The pipeline will match emails by arrival timestamp and subject prefix, not by recipient address.

> In Vercel dashboard → Project → Settings → Environment Variables → add `TEST_EMAIL` scoped to **Preview** only.

### 3. Add GitHub Actions secrets

In your GitHub repository → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `INNGEST_EVENT_KEY_STAGING` | Inngest staging environment Event Key |
| `INNGEST_SIGNING_KEY_STAGING` | Inngest staging environment Signing Key |
| `MAILTRAP_API_TOKEN` | Token from step 1 |
| `MAILTRAP_ACCOUNT_ID` | Account ID from step 1 |
| `MAILTRAP_INBOX_ID` | Inbox ID from step 1 |
| `VERCEL_TOKEN` | Vercel personal access token (for `wait-for-vercel-preview` action) |

### 4. Ensure branch protection is configured

In GitHub → repository **Settings → Branches → Branch protection rules** for `main`:
- Enable **Require status checks to pass before merging**
- Add `ci-gate` as the required check (only `ci-gate`, not the individual test jobs)

---

## Running E2E Tests Manually

You can run the e2e test suite locally against any deployed Preview URL:

```bash
# Install dependencies (includes @mailtrap/mailtrap-client as devDep)
npm install

# Set environment variables
export PREVIEW_URL=https://your-preview-url.vercel.app
export INNGEST_EVENT_KEY_STAGING=<staging event key>
export INNGEST_SIGNING_KEY_STAGING=<staging signing key>
export MAILTRAP_API_TOKEN=<token>
export MAILTRAP_ACCOUNT_ID=<account id>
export MAILTRAP_INBOX_ID=<inbox id>

# Run all e2e email tests
npm run test:e2e

# Run a specific flow
npm run test:e2e -- --testPathPattern=weekly-analytics
```

---

## Adding a New Email Flow

When a new Inngest email workflow is added to the service:

1. Add an entry to `tests/e2e/email/flow-map.ts`:
   ```ts
   "new-flow-name": {
     patterns: ["src/inngest/functions/new-flow*.ts"],
     event: "sol/new.flow.event",
     eventData: { clientId: "test-seed-client" },
     testFile: "new-flow.test.ts",
   }
   ```
2. Create `tests/e2e/email/new-flow.test.ts` with assertions for that flow's email
3. Update `.github/workflows/e2e-email.yml` to add the new path filter for `dorny/paths-filter`

That's all — the CI gate and skip logic are inherited automatically.

---

## How the Pipeline Works (Summary)

```
PR opened / commit pushed
  ↓
GitHub Actions: detect changed files (dorny/paths-filter)
  ↓ (if no email files changed → skip all → ci-gate passes → PR unblocked)
GitHub Actions: wait for Vercel Preview to be ready (polls Vercel API, max 3 min)
  ↓
For each affected flow:
  1. Record timestamp T
  2. POST event to Inngest staging → get eventId
  3. Poll Inngest run status until Completed/Failed (max 90s)
  4. Poll Mailtrap for email with created_at >= T and matching subject (max 90s)
  5. Run Vitest assertions on subject, HTML body, dynamic fields
  ↓
ci-gate job: succeeds if all flow jobs passed or were skipped
  ↓
PR status check updated → merge unblocked (or blocked if assertions failed)
```
