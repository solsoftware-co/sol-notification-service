# Research: Production Deployment to Vercel

**Feature**: 009-vercel-prod-deploy
**Date**: 2026-03-05

---

## Decision 1: Vercel Deployment Model

**Decision**: Serverless API routes in `api/` directory (Vercel Pages Router pattern), not a long-running server.

**Rationale**: Vercel's Hobby plan does not support long-running Node.js processes. `src/index.ts` is a plain HTTP server — it works for `npm run dev` locally but cannot run on Vercel as-is. Vercel expects serverless function handlers exported from files in the `api/` directory. Each invocation is stateless; Inngest's step-based orchestration is designed exactly for this model — each step is a short, independent HTTP call, not a long-running connection.

**Alternatives considered**:
- Deploying as a containerised long-running server (Railway, Fly.io) — rejected because Vercel is already in the approved constitution stack and this would add unapproved infrastructure.
- Restructuring the project to Next.js — rejected as over-engineering; Next.js App Router is not needed for a pure API service.

---

## Decision 2: Inngest Serve Adapter

**Decision**: Use `inngest/vercel` adapter in `api/inngest.ts`.

**Rationale**: The Inngest SDK ships framework-specific adapters. The current codebase uses `inngest/node` for the local HTTP server — this works for `npm run dev` and remains unchanged. For Vercel, `inngest/vercel` creates a handler compatible with Vercel's serverless function signature. The same `inngest` client and `functions` array are shared between both.

**Pattern**:
```ts
// api/inngest.ts
import { serve } from "inngest/vercel";
import { inngest } from "../src/inngest/client";
import { functions } from "../src/inngest/functions";

export const config = { api: { bodyParser: false } };
export default serve({ client: inngest, functions });
```

The `config.api.bodyParser = false` is required — Inngest reads the raw request body for signature verification; Vercel's built-in body parser must be disabled.

**Alternatives considered**:
- `inngest/express` with an Express wrapper — unnecessary overhead; `inngest/vercel` is the correct fit.

---

## Decision 3: Vercel Project Configuration (`vercel.json`)

**Decision**: Add a minimal `vercel.json` setting `maxDuration: 60` for the Inngest handler and `framework: null` to signal this is not a Next.js project.

**Rationale**: Without `vercel.json`, Vercel may detect the TypeScript project and misidentify it as Next.js. Setting `framework: null` ensures Vercel uses the standard Node.js build (runs `npm run build` → `tsc`, serves `api/` functions). `maxDuration: 60` is the Hobby plan cap; Inngest step invocations are short-lived so this is sufficient — the Inngest platform orchestrates sequencing between short invocations, not within a single long one.

**Key settings**:
```json
{
  "framework": null,
  "functions": {
    "api/inngest.ts": { "maxDuration": 60 },
    "api/health.ts":  { "maxDuration": 10 }
  }
}
```

---

## Decision 4: Required Environment Variables in Vercel

**Decision**: Seven environment variables must be set in Vercel → Settings → Environment Variables for the Production environment.

| Variable | Where to get it | Notes |
|---|---|---|
| `DATABASE_URL` | Neon dashboard → production branch → Connection string | Must be a separate production connection string, not the dev branch |
| `RESEND_API_KEY` | Resend dashboard → API Keys | Must be a live key (not a test key) |
| `RESEND_FROM` | Resend dashboard → Domains → verified sender | Must be a verified domain address |
| `GA4_SERVICE_ACCOUNT_JSON` | Google Cloud Console → Service Accounts → JSON key | Paste the entire JSON as a single-line string |
| `LOGTAIL_SOURCE_TOKEN` | Better Stack → Sources → HTTP source token | Spec 008 — set for Production and Preview |
| `INNGEST_SIGNING_KEY` | Inngest Cloud → App settings → Signing key | Created when registering the production app |
| `INNGEST_EVENT_KEY` | Inngest Cloud → Manage → Event keys | Used to send events to Inngest Cloud |

`VERCEL_ENV` is automatically injected by Vercel as `"production"` — do NOT set it manually.

**Rationale**: `config.ts` already reads all these variables at startup. The application will throw or fall back to dev defaults for any missing variable — production must have all of them set to avoid silent mock-mode fallbacks.

---

## Decision 5: Neon Production Database

**Decision**: Use Neon's main branch as the production database. Create a separate dev/preview branch for non-production use.

**Rationale**: Neon's branching model maps perfectly to the multi-environment safety requirement: main branch → production, development branch → preview and local dev. The schema is already defined in `scripts/setup-db.ts` (idempotent) — run it once against the production `DATABASE_URL` to initialise tables. Seed real client rows via `scripts/seed-data.ts` or insert directly.

**Alternatives considered**: Separate Neon project for production — rejected as unnecessary complexity; branches within a single project achieve the same isolation at no extra cost.

---

## Decision 6: Inngest Cloud Registration Order

**Decision**: Deploy to Vercel first, then register in Inngest Cloud. Credentials flow in this order:

1. Get `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` from Inngest Cloud after creating the app
2. Add them to Vercel env vars and redeploy (or trigger a new deploy)
3. Inngest Cloud syncs functions automatically on each deploy via the serve endpoint

**Rationale**: Inngest Cloud cannot discover functions until the serve endpoint is live. The signing key must be present in the environment before Inngest Cloud calls start arriving — a cold-start without it causes signature verification failures. The safe order avoids this: create the Inngest Cloud app → copy keys → set in Vercel → deploy → then register the serve URL in Inngest Cloud.

---

## Decision 7: No New npm Dependencies Required

**Decision**: The `inngest` package already ships the `inngest/vercel` adapter — no additional packages needed.

**Rationale**: The `inngest` package (already installed) exports framework adapters for all major platforms including Vercel. Adding `@vercel/node` for TypeScript types is optional — the health check handler can be typed using standard `node:http` types which are already available.

**Impact on constitution**: No amendment needed — no new technologies introduced.
