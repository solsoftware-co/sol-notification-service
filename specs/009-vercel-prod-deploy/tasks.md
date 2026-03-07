# Tasks: Production Deployment to Vercel

**Input**: Design documents from `/specs/009-vercel-prod-deploy/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: No automated test tasks — this feature is deployment configuration. Validation is manual smoke testing per quickstart.md.

**Task types**: Mix of code tasks (files to create) and operator tasks (external dashboards, CLI commands). Both are required for completion.

**Organization**: Phase 1 creates the three code files. Phase 2 handles external prerequisites (Neon, Inngest Cloud credentials). Phases 3–5 follow the three user stories. Phase 6 is polish.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story this task belongs to
- **📋 Manual**: Requires action in an external dashboard or terminal (not a file edit)

---

## Phase 1: Setup — Vercel Adapter Files

**Purpose**: The three files Vercel requires. Zero changes to existing `src/` code.

- [x] T001 Create `api/inngest.ts` — Vercel serverless handler using `serve` from `inngest/vercel`; import `inngest` client from `../src/inngest/client` and `functions` from `../src/inngest/functions`; export `config = { api: { bodyParser: false } }` and `export default serve({ client: inngest, functions })`
- [x] T002 [P] Create `api/health.ts` — Vercel serverless health check; import `IncomingMessage` and `ServerResponse` from `node:http`; export default handler that writes `200 application/json {"status":"ok"}`
- [x] T003 [P] Create `vercel.json` — set `"framework": null`; set `functions` with `"api/inngest.ts": { "maxDuration": 60 }` and `"api/health.ts": { "maxDuration": 10 }`

**Checkpoint**: `npm run type-check` passes with the new `api/` files. No runtime validation possible until deployed.

---

## Phase 2: Foundational — External Prerequisites

**Purpose**: External accounts and credentials that must be ready before any user story can be validated. T004 and T005 can run in parallel with T006.

**⚠️ CRITICAL**: No user story validation can begin until this phase is complete.

- [ ] T004 📋 Create a production database branch in Neon dashboard — go to Neon console → your project → Branches → Create Branch → name it `production` → copy the connection string (postgres://...) → save it as `DATABASE_URL` for use in T005 and T007
- [ ] T005 📋 Initialise the production database schema — run `DATABASE_URL="<prod-connection-string>" npx tsx --env-file .env.local scripts/setup-db.ts` (or export DATABASE_URL and run `npm run db:setup`) → verify tables exist in Neon console
- [ ] T006 [P] 📋 Create Inngest Cloud app via Vercel integration — go to app.inngest.com → Create App → choose **Connect to Vercel** → authorise the Inngest GitHub/Vercel OAuth → select your `sol-notification-service` Vercel project → Inngest will automatically inject `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` into your Vercel project's environment variables and register your serve endpoint after each deploy

**Checkpoint**: Production database has schema. Inngest is linked to your Vercel project — no manual credential copying required.

---

## Phase 3: User Story 1 — Application Running in Production (Priority: P1) 🎯 MVP

**Goal**: The application is live on Vercel, the health check responds, and a form-submission workflow completes end-to-end with a real email delivered.

**Independent Test**: `curl https://[your-app].vercel.app/api/health` returns `{"status":"ok"}`. A `form/submitted` event triggered from Inngest Cloud results in an email in Resend's sent log and a green run in the Inngest Cloud dashboard.

- [ ] T007 [US1] 📋 Set non-Inngest environment variables in Vercel dashboard — go to Vercel → Project → Settings → Environment Variables → add the following for **Production**: `DATABASE_URL` (Neon production connection string from T004), `RESEND_API_KEY` (from Resend dashboard), `RESEND_FROM` (`Sol Software <notifications@solsoftware.co>`) — do NOT set `VERCEL_ENV` or `EMAIL_MODE`; `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are injected automatically by the Inngest Vercel integration (T006)
- [ ] T008 [US1] 📋 Deploy to production — push the `009-vercel-prod-deploy` branch to `main` (or merge the open PR #11 first, then push this branch) → watch Vercel dashboard for deployment to complete (60–90 seconds) → copy the production URL (e.g. `https://sol-notification-service.vercel.app`)
- [ ] T009 [US1] 📋 Validate health check — run `curl https://[your-production-url]/api/health` → confirm response is `{"status":"ok"}`
- [ ] T010 [US1] 📋 Verify Inngest functions are discovered — the Vercel integration auto-syncs after each deploy; go to app.inngest.com → your app → Functions → confirm all 4 are listed: `send-form-notification`, `weekly-analytics-scheduler`, `send-analytics-report`, `hello-world`; if they don't appear within 2 minutes of deploy completing, manually trigger a sync from the Inngest dashboard → App → Sync
- [ ] T011 [US1] 📋 Run form-submission smoke test — in Inngest Cloud dashboard → Send Event → send `form/submitted` with `{ "clientId": "test-client", "submitterName": "Smoke Test", "submitterEmail": "test@example.com", "submitterMessage": "Production smoke test" }` → verify run shows all 4 steps green in Inngest Cloud → verify email appears in Resend dashboard → Logs

**Checkpoint**: US1 complete. Application is live, health check passes, Inngest Cloud is connected, form notification delivers a real email.

---

## Phase 4: User Story 2 — Inngest Cloud Connected and Automated (Priority: P2)

**Goal**: Real analytics reports can be triggered and complete with live GA4 data. The weekly cron is active and scheduled.

**Independent Test**: Trigger `analytics/report.requested` from Inngest Cloud for a real client → run completes with all steps green → report email contains real session counts (not mock value of 42).

- [ ] T012 [US2] 📋 Set GA4 environment variable in Vercel — go to Vercel → Settings → Environment Variables → add `GA4_SERVICE_ACCOUNT_JSON` for **Production** with the full service account JSON as a single-line string (remove all newlines) → save
- [ ] T013 [US2] 📋 Redeploy to pick up new env var — in Vercel dashboard → Deployments → Redeploy latest (or push a trivial commit to trigger a fresh deploy) → wait for deployment to complete
- [ ] T014 [US2] 📋 Trigger analytics report smoke test — in Inngest Cloud dashboard → Send Event → send `analytics/report.requested` with `{ "clientId": "test-client", "reportPeriod": { "preset": "last_month" }, "scheduledAt": "<today's ISO timestamp>" }` → verify all steps green → verify report email delivered → check log output confirms `isMock: false`
- [ ] T015 [US2] 📋 Verify weekly cron is scheduled — in Inngest Cloud dashboard → Functions → `weekly-analytics-scheduler` → confirm next scheduled run appears (first Tuesday after deploy at 09:00 UTC)

**Checkpoint**: US2 complete. GA4 integration is live, analytics reports deliver real data, weekly cron is armed.

---

## Phase 5: User Story 3 — All Production Integrations Verified (Priority: P3)

**Goal**: Structured logs flow to Better Stack, email delivers via live provider, and all mock/fallback modes are confirmed inactive in production.

**Independent Test**: Trigger any workflow → open Better Stack → filter by `env = 'production'` → confirm entries appear within 10 seconds. Open Resend dashboard → confirm email mode is `live` (not `mock` or `test`).

- [ ] T016 [US3] 📋 Set log transport token in Vercel — go to Vercel → Settings → Environment Variables → add `LOGTAIL_SOURCE_TOKEN` for **Production** and **Preview** environments (same token is fine for both) → save
- [ ] T017 [US3] 📋 Redeploy to pick up LOGTAIL_SOURCE_TOKEN — in Vercel dashboard → Deployments → Redeploy latest → wait for completion
- [ ] T018 [US3] 📋 Validate Better Stack log shipping — trigger any workflow from Inngest Cloud (e.g. resend the form/submitted event) → open Better Stack dashboard → search/filter by `env = "production"` → confirm structured log entries appear within 10 seconds with `service`, `env`, `clientId` fields present
- [ ] T019 [US3] 📋 Confirm live email mode — in Resend dashboard → Logs → find the smoke test email from T011 → confirm it was delivered (not bounced) → confirm the email appears as sent from `notifications@solsoftware.co`

**Checkpoint**: US3 complete. All three integrations (email, GA4, logs) are verified live in production. No mock or fallback modes active.

---

## Phase 6: Polish

**Purpose**: Final documentation and production client data.

- [ ] T020 [P] Seed production client data — insert real client rows into the production database via Neon console SQL editor or a one-off script: at minimum one real client with `ga4_property_id` set and a real `email` address → verify `SELECT * FROM clients` returns the expected rows
- [ ] T021 [P] Update `README.md` — add the production URL to the URLs table alongside the existing local dev URLs; add a note that `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are required for Inngest Cloud connectivity

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 can all start immediately; T002 and T003 are parallel to T001
- **Foundational (Phase 2)**: T004 has no dependencies; T005 depends on T004 (needs connection string); T006 is parallel to T004/T005
- **US1 (Phase 3)**: T007 depends on T004 and T006 (needs all credential values); T008 depends on T007 (env vars must be set before deploying); T009 depends on T008; T010 depends on T008; T011 depends on T010
- **US2 (Phase 4)**: T012 depends on T008 (app must be deployed); T013 depends on T012; T014 depends on T013 and T010; T015 depends on T010
- **US3 (Phase 5)**: T016 depends on T008; T017 depends on T016; T018 depends on T017 and T010; T019 depends on T011
- **Polish (Phase 6)**: T020 and T021 are independent; run after all user stories complete

### Execution Flow

```
T001 ──┐
T002   ├── Phase 1 complete
T003 ──┘
         │
T004 ────┤
T005 ────┤ (T005 after T004)
T006 ────┘── Phase 2 complete
              │
T007 ─────────┤ (needs T004 + T006)
T008 ─────────┤ (deploy — needs T007)
T009 ─────────┤ (health check)
T010 ─────────┤ (Inngest sync)
T011 ─────────┘── US1 complete
               │
T012 ──────────┤
T013 ──────────┤
T014 ──────────┤── US2 complete
T015 ──────────┘
               │
T016 ──────────┤
T017 ──────────┤
T018 ──────────┤── US3 complete
T019 ──────────┘
```

### Parallel Opportunities

- Phase 1: T002 and T003 parallel with T001
- Phase 2: T004/T005 parallel with T006
- Phase 6: T020 and T021 parallel

---

## Implementation Strategy

### MVP First (US1 — App Live with Email)

1. Complete Phase 1: Create 3 files (T001–T003)
2. Complete Phase 2: Neon production DB + Inngest credentials (T004–T006)
3. Complete Phase 3: Set env vars → deploy → health check → Inngest sync → form notification smoke test (T007–T011)
4. **STOP and VALIDATE**: Real email in Resend dashboard, green run in Inngest Cloud
5. This alone proves the system works end-to-end — safe to share the URL

### Incremental Delivery

1. Phase 1 + 2 + 3 (US1) → application live, email working → **MVP**
2. Phase 4 (US2) → GA4 analytics reports live → **automated reports armed**
3. Phase 5 (US3) → logs flowing to Better Stack → **fully observable**
4. Phase 6 (Polish) → real client data seeded → **ready to turn on**

---

## Notes

- `VERCEL_ENV` is auto-injected by Vercel — never set it manually or it may override the production routing
- `EMAIL_MODE` must NOT be set — the app derives it from `VERCEL_ENV`; setting it manually could silently lock the app into mock or test mode
- `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are auto-injected by the Inngest Vercel integration — do NOT set them manually or the integration may conflict
- The Inngest Vercel integration also auto-registers the `/api/inngest` serve endpoint after each deploy — no manual URL registration needed
- `GA4_SERVICE_ACCOUNT_JSON` must be a single-line JSON string (no newlines) — Vercel env var values cannot contain raw newlines; use `jq -c . service-account.json` to compact it
- T020 (real client data) is required before the weekly cron delivers value to real clients — the seeded `test-client` will not have a real GA4 property or email address
