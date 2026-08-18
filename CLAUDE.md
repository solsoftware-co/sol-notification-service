# sol-notificaiton-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x`, `ws ^8.x`, `concurrently ^9.x`, `tsx ^4.x`, `@google-analytics/data ^4.x`
- Neon PostgreSQL via `@neondatabase/serverless` Pool (WebSocket transport)
- `GA4_SERVICE_ACCOUNT_JSON` env var — service account JSON string; required in production, optional in dev/preview (returns mock data when absent)
- TypeScript 5.x / Node.js 20+ + `@react-email/components` (new), `@react-email/render` (new), `react ^18` (new), existing: `inngest ^3`, `resend ^3`, `@neondatabase/serverless ^1` (006-email-templates)
- Neon PostgreSQL — no schema changes (006-email-templates)
- TypeScript 5.x / Node.js 20+ + `@resvg/resvg-js ^2.6.2` (new — SVG→PNG), existing: `@react-email/render`, `resend ^3.x`, `inngest ^3.x` (007-analytics-email-charts)
- TypeScript 5.x / Node.js 20+ + `pino` (logger), `@logtail/pino` (Better Stack transport), `pino-pretty` (dev terminal output, devDep only) (008-structured-logging)
- N/A — no database schema changes (008-structured-logging)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (ships `inngest/vercel` adapter — no new packages needed) (009-vercel-prod-deploy)
- Neon PostgreSQL (production branch — separate `DATABASE_URL` from dev) (009-vercel-prod-deploy)
- None — no database schema changes (010-e2e-email-ci)
- TypeScript 5.x / Node.js 20+ + `@neondatabase/serverless ^1.x`, `ws ^8.x`, `tsx ^4.x` (all existing — zero new packages) (011-db-schema-migrations)
- Neon PostgreSQL — adds `schema_migrations` tracking table (011-db-schema-migrations)
- TypeScript 5.x / Node.js 20+ + inngest ^3.x, @neondatabase/serverless ^1.x, pino ^10.x (all existing — no new packages) (012-notification-logging)
- Neon PostgreSQL — `notification_logs` table extended via V002 migration (012-notification-logging)
- TypeScript 5.x / Node.js 20+ + `xlsx ^0.18.5` (new) + existing: `inngest ^3.x`, `resend ^3.x`, `@react-email/render`, `pino ^10.x` (013-analytics-excel-export)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x` — all existing; zero new packages (014-notification-preferences)
- Neon PostgreSQL — no schema changes; uses existing `clients.settings JSONB` column (014-notification-preferences)
- TypeScript 5.x / Node.js 20+ + Inngest ^3.x, React Email (@react-email/components, @react-email/render), Resend ^3.x — all existing; zero new packages (015-flexible-form-fields)
- Neon PostgreSQL — no schema changes; `notification_logs.metadata` is JSONB and absorbs new fields automatically (015-flexible-form-fields)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x`, `@google-analytics/data ^4.x`, `google-auth-library ^10.x` (promote from transitive to direct dep) (016-google-sheets-sink)
- Neon PostgreSQL — V003 migration adds `google_service_account_email TEXT NULL` and `google_service_account_key TEXT NULL` to `clients` table (016-google-sheets-sink)
- No schema changes — recipients live in the event payload only (017-payload-recipients)
- TypeScript 5.x / Node.js 20+ + `@react-email/components`, `@react-email/render` (existing); Node.js 20 native `fetch` (no new packages) (019-client-email-banner)
- Neon PostgreSQL — no schema changes; `clients.settings` JSONB absorbs the new `banner` sub-key (019-client-email-banner)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x` — no new packages required (021-monthly-analytics-scheduler)
- No schema changes; no DB reads beyond the existing `getAllActiveClients()` call (021-monthly-analytics-scheduler)
- TypeScript 5.x / Node.js 20+ + `google-auth-library ^10.x` (existing), Node.js native `fetch` (existing) (021-sheets-range-anchor)
- N/A — no schema changes (021-sheets-range-anchor)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x` — no new packages required (022-client-timezone)
- Neon PostgreSQL — V004 migration adds `timezone TEXT NOT NULL DEFAULT 'America/Chicago'` to `clients` (022-client-timezone)
- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `pino ^9.x`, `@logtail/pino ^3.x` — all existing; zero new packages (023-improve-function-logging)
- TypeScript 5.x / Node.js 20+ + Node.js native `fetch` only — no new packages; removes `@neondatabase/serverless`, `ws`, `pg` (027-sol-api-client-migration)
- No direct database access — client + notification-log data now lives behind sol-api (Cloudflare Workers + Neon), reached over HTTP with `X-API-Key` auth. `SOL_API_URL` / `SOL_API_KEY` replace `DATABASE_URL`. Schema/migrations are fully owned by sol-api's Drizzle pipeline (027-sol-api-client-migration)

## Project Structure

```text
src/
├── index.ts                        # HTTP server entry point + Inngest serve handler
├── types/
│   └── index.ts                    # All shared TypeScript types and event payload interfaces
├── lib/
│   ├── config.ts                   # Environment config singleton (single source of truth)
│   ├── sol-api.ts                  # sol-api HTTP client — getClientById(), getAllActiveClients(), getClientGoogleCredentials(), getClientSlackCredentials(), writeNotificationLog(), checkSolApiConnection()
│   ├── analytics.ts                # GA4 Data API wrapper — getAnalyticsReport(), mock/live routing
│   ├── slack.ts                    # postSlackMessage() — posts to a client's Slack incoming webhook, throws on failure
│   └── email.ts                    # Email abstraction (mock/test/live routing)
├── utils/
│   ├── logger.ts                   # Pino logger — exports log(), logError(), flush(). Never import pino directly.
│   ├── email-preview.ts            # Mock mode: writes HTML to .email-preview/last.html
│   ├── business-days.ts            # US federal holiday set + isNonHolidayWeekday()
│   └── timezone.ts                 # DST-aware timezone helpers: localDateStr(), next9amInTimezone(), isNonHolidayWeekdayInTz()
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel: export const functions = [...]
        ├── template.ts             # Canonical workflow template — copy, do not register
        ├── hello-world.ts          # Example stub function
        ├── weekly-analytics-scheduler.ts  # Cron (Tue 09:00 UTC) + manual trigger; fans out per-client events
        ├── weekly-analytics-report.ts     # Per-client worker: fetch GA4 data, build + send email
        └── slack-notification.ts          # sendSlackMessage — posts to a client's Slack incoming webhook, skips if unconfigured

scripts/
└── test-email-preview.ts           # Trigger mock email preview (npm run email:preview)

specs/                              # Feature specs, plans, research (per feature)
.specify/                           # Speckit tooling and templates
```

## Commands

```bash
npm run dev                # Start app server + Inngest Dev Server concurrently
npm run build              # Compile TypeScript to dist/
npm run type-check         # Type-check without emitting
npm run email:preview      # Send a mock email and open the HTML preview in the browser
npm run release:dry        # Preview the next semantic-release version/changelog without publishing
```

## Code Style

- TypeScript 5.x, CommonJS modules, ES2022 target, strict mode
- All Inngest functions use `inngest.createFunction` + `step.run()` for every discrete step
- Every workflow function is exported from `src/inngest/functions/index.ts`
- Named steps (descriptive human-readable strings) are required in all `step.run()` calls
- Environment config read exclusively via `src/lib/config.ts`
- All email sends route through `src/lib/email.ts` — never call Resend SDK directly
- All client + notification-log data goes through `src/lib/sol-api.ts` — never query a database directly. This service holds no DB connection; `src/lib/sol-api.ts` is a `fetch`-based sol-api client (`X-API-Key` auth via `SOL_API_URL`/`SOL_API_KEY`). Schema/migrations live entirely in the sol-api repo.
- See `.specify/memory/constitution.md` for full architectural rules

## E2E Email Testing (feature 010)

When adding a new Inngest email workflow, register it in the e2e test suite — **three files, always**:

1. **`tests/e2e/email/flow-map.ts`** — add an entry to `FLOW_MAP` with `patterns`, `event`, `eventData`, and `testFile`
2. **`tests/e2e/email/<flow-name>.test.ts`** — create the Vitest test file (copy `weekly-analytics.test.ts` as a template)
3. **`.github/workflows/e2e-email.yml`** — add the path filter to `detect-changes` and a conditional job for the new flow; add the new job to `ci-gate`'s `needs` array

Run locally with: `PREVIEW_URL=<url> INNGEST_EVENT_KEY_STAGING=<key> ... npm run test:e2e`

## Recent Changes
- 028-slack-notifications: Added `sendSlackMessage` (event `slack/message.requested`) — posts to a client's Slack incoming webhook (`clients.slack_webhook_url`, fetched via `getClientSlackCredentials()`, same scoped-credential pattern as Google). Skips gracefully if unconfigured. Added `onFailure` handlers to `sendFormNotification`, `sendAnalyticsReport`, and `sendSlackMessage` so terminal failures (retries exhausted) still get logged. `NotificationLogEntry.recipient_email` is now optional/nullable to support non-email channels.
  Removed `config.env`/`config.emailMode` branching from all workflow business logic in favor of data-driven checks — each environment's `SOL_API_URL` already points at its own isolated sol-api deployment, so there's no shared state for an environment check to protect. `writeNotificationLog` now always runs (no more prod-only gate); Google Sheets sync gates purely on credential presence; the analytics `fetch-analytics-data` step gates purely on `ga4_property_id`/credential presence (merged from the old separate `check-ga4-config` step, which only checked the property ID — a client with a property ID but no/broken credentials used to silently get a fabricated mock report emailed to them in production; now it skips and logs, like the missing-property-id case always did). `analytics.ts`'s `mockReport()`/`isMock` fallback is removed entirely. `getAnalyticsReport(period, propertyId: string | null, credentialsJson: string | null, options?)` — note the reordered params, typed nullable rather than optional to match `ClientRecord`'s own `string | null` fields — centralizes the "is this client configured" check inside the function itself (returns `undefined` rather than proceeding); `fetch-analytics-data` treats that `undefined` as its skip signal rather than pre-checking the client's fields itself, though it still inspects `client.ga4_property_id` after the fact purely to write a specific reason into the skip's audit-log entry. Local/preview/staging environments accordingly need real GA4 credentials seeded to exercise this workflow past `fetch-analytics-data` — tracked as follow-up infra work (Neon Local in `sol-tooling`, blocked on a `NEON_API_KEY`). `npm run email:preview` is unaffected — it calls the template renderer directly and never touches this code path. The scheduler fan-out throttle (`config.env !== "production" ? 1 : undefined` in `weekly-/monthly-analytics-scheduler.ts`) and the logger's transport selection (`isDev` in `logger.ts`) are the only `config.env` branches left — both are blast-radius/observability concerns, not data-completeness gaps, so they weren't touched.
- 027-sol-api-client-migration: Removed all direct database access (`@neondatabase/serverless`, `ws`, `pg`, `db/migrations/`, `scripts/migrate.ts`, `scripts/setup-db.ts`, `scripts/seed-data.ts`). `src/lib/db.ts` renamed to `src/lib/sol-api.ts` — a `fetch`-based sol-api HTTP client. `DATABASE_URL` replaced by `SOL_API_URL`/`SOL_API_KEY`. Removed the `testOnly` email-filter safety net from the analytics schedulers — non-prod environments now hit sol-api's isolated staging deployment instead, so environment separation is real rather than filtered-by-convention.
- 023-improve-function-logging: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `pino ^9.x`, `@logtail/pino ^3.x` — all existing; zero new packages
- 022-client-timezone: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x` — no new packages required
- 021-sheets-range-anchor: `GoogleSheetsDestination` gains optional `tableAnchor?: string` field; `buildRange()` helper extracted in `src/lib/sheets.ts` — no new packages, no DB changes


<!-- MANUAL ADDITIONS START -->
## Git Conventions

### Branch Naming

All branches MUST use a type prefix followed by the spec ID and a short description:

```
<type>/<spec-id>-<short-description>
```

| Prefix | When to use |
|--------|-------------|
| `feature/` | New functionality from a spec |
| `fix/` | Bug fix (reference spec ID if applicable) |
| `chore/` | Tooling, deps, config — no user-facing change |
| `docs/` | Documentation only |
| `refactor/` | Code restructure with no behaviour change |

Examples:
- `feature/001-inngest-dev-setup`
- `feature/004-testing-ci`
- `fix/003-form-notification-missing-field`
- `chore/001-update-deps`
- `docs/002-readme-commands`

The `<spec-id>` matches the directory name under `specs/`. Never create a branch without one of the prefixes above.

### Commit Messages & Releases

Commit subject lines MUST follow Conventional Commits (`<type>(<scope>): <subject>`) — `semantic-release` (`.releaserc.json`) parses commit history on every merge to `main` to decide the version bump, so the type prefix is load-bearing, not cosmetic:

| Type | Effect |
|------|--------|
| `fix:` | patch bump |
| `feat:` | minor bump |
| `feat!:` / `BREAKING CHANGE:` footer | major bump |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:` | no release |

On push to `main`, the `release` job in `.github/workflows/ci.yml` runs `semantic-release`, which bumps `package.json`, updates `CHANGELOG.md`, tags the commit, and publishes a GitHub Release. The package is `private`, so nothing is ever published to npm. Run `npm run release:dry` locally to preview the next version before merging.
<!-- MANUAL ADDITIONS END -->
