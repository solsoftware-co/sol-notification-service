# Implementation Plan: Production Deployment to Vercel

**Branch**: `009-vercel-prod-deploy` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-vercel-prod-deploy/spec.md`

## Summary

Deploy the sol-notification-service to Vercel production so that real workflows run end-to-end: form submissions deliver emails via Resend, weekly analytics reports fetch real GA4 data and deliver to clients, and all structured logs flow to Better Stack. The core application code is already complete — this plan covers the thin adapter layer Vercel requires (`api/` directory with the `inngest/vercel` adapter), the `vercel.json` configuration, and the ordered sequence of environment variable setup, database initialisation, and Inngest Cloud registration needed to go live.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `inngest ^3.x` (ships `inngest/vercel` adapter — no new packages needed)
**Storage**: Neon PostgreSQL (production branch — separate `DATABASE_URL` from dev)
**Testing**: Vitest 2.x (existing suite — 100 tests; no new test files for deployment config)
**Target Platform**: Vercel Hobby plan (serverless functions, 60s max duration per invocation)
**Project Type**: Web service — serverless API functions
**Performance Goals**: Each Inngest step invocation completes within 60s (Vercel Hobby limit); Inngest orchestrates step sequencing across short-lived invocations
**Constraints**: Vercel Hobby plan — no long-running server process; serverless functions only
**Scale/Scope**: PoC — ≤50k Inngest runs/month, ≤3k emails/month, ≤512 MB Neon, all within free tiers

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Event-Driven Workflow First | ✅ PASS | All workflows already implemented as Inngest functions with `step.run()` |
| II. Multi-Environment Safety | ✅ PASS | `VERCEL_ENV` auto-injected by Vercel; `EMAIL_MODE` must NOT be set manually — config derives it from `VERCEL_ENV` |
| III. Multi-Tenant by Design | ✅ PASS | Already implemented; production database will hold real client rows |
| IV. Observability by Default | ✅ PASS | `LOGTAIL_SOURCE_TOKEN` required in Vercel env vars; all step outcomes already logged |
| V. AI-Agent Friendly | ✅ PASS | Spec exists; no new workflow patterns introduced |
| VI. Minimal Infrastructure | ✅ PASS | Vercel is in the approved stack; `inngest/vercel` adapter is bundled in the existing `inngest` package — zero new infrastructure or dependencies |

No complexity tracking required — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-vercel-prod-deploy/
├── plan.md        ← this file
├── research.md    ← Phase 0 output
├── quickstart.md  ← Phase 1 output
└── tasks.md       ← Phase 2 output (speckit.tasks)
```

No `data-model.md` — this feature introduces no new data entities.
No `contracts/` — the Inngest serve endpoint contract is documented in `quickstart.md`.

### Source Code Changes

Minimal — three new files, zero changes to existing source:

```text
api/
├── inngest.ts     # NEW — Vercel serverless handler for Inngest (uses inngest/vercel adapter)
└── health.ts      # NEW — Vercel serverless health check endpoint

vercel.json        # NEW — Vercel project configuration (framework, maxDuration)
```

**No changes to `src/`** — existing code works as-is. `src/index.ts` continues to serve `npm run dev` locally. The `api/` files are Vercel-only entry points that import from `src/` directly.

## Implementation Approach

### Phase 1: Vercel Adapter Files

**`api/inngest.ts`** — Wraps the existing Inngest client and functions using the Vercel adapter. Disables Vercel's built-in body parser (required for Inngest signature verification).

```ts
import { serve } from "inngest/vercel";
import { inngest } from "../src/inngest/client";
import { functions } from "../src/inngest/functions";

export const config = { api: { bodyParser: false } };
export default serve({ client: inngest, functions });
```

**`api/health.ts`** — Simple health check that reuses the existing DB connection check.

```ts
import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}
```

**`vercel.json`** — Signals to Vercel that this is a plain Node.js project (not Next.js) and sets the max invocation duration for each function.

```json
{
  "framework": null,
  "functions": {
    "api/inngest.ts": { "maxDuration": 60 },
    "api/health.ts":  { "maxDuration": 10 }
  }
}
```

### Phase 2: External Configuration (Manual Steps)

These are ordered — each step depends on the previous:

1. **Neon production database** — Create production branch → copy connection string → run `npm run db:setup` with production `DATABASE_URL` → seed real client rows
2. **Inngest Cloud app** — Create app → copy `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`
3. **Vercel environment variables** — Set all 7 required variables in Vercel dashboard (Production environment)
4. **Deploy** — Push `main` → Vercel auto-deploys
5. **Inngest Cloud sync** — Enter production serve URL in Inngest Cloud → verify all 4 functions discovered
6. **End-to-end validation** — Follow `quickstart.md` Steps 6–9

### Required Environment Variables

| Variable | Required For | Auto-set? |
|---|---|---|
| `DATABASE_URL` | DB queries in every workflow | ❌ Must set in Vercel |
| `RESEND_API_KEY` | Live email delivery | ❌ Must set in Vercel |
| `RESEND_FROM` | Email sender address | ❌ Must set in Vercel |
| `GA4_SERVICE_ACCOUNT_JSON` | Real analytics data | ❌ Must set in Vercel |
| `LOGTAIL_SOURCE_TOKEN` | Better Stack log shipping | ❌ Must set in Vercel (Production + Preview) |
| `INNGEST_SIGNING_KEY` | Webhook signature verification | ❌ Must set in Vercel |
| `INNGEST_EVENT_KEY` | Sending events to Inngest Cloud | ❌ Must set in Vercel |
| `VERCEL_ENV` | Environment routing (`production`) | ✅ Auto-injected by Vercel |

**Critical**: Do NOT set `EMAIL_MODE` or `VERCEL_ENV` manually — these must be derived automatically. Setting `EMAIL_MODE` explicitly could override production to `mock` or `test` mode, silently breaking email delivery.

## Complexity Tracking

No violations. All additions are within the approved constitution stack.
