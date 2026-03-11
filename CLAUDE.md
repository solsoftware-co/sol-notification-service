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

## Project Structure

```text
src/
├── index.ts                        # HTTP server entry point + Inngest serve handler
├── types/
│   └── index.ts                    # All shared TypeScript types and event payload interfaces
├── lib/
│   ├── config.ts                   # Environment config singleton (single source of truth)
│   ├── db.ts                       # Neon Pool singleton + getClientById() + getAllActiveClients()
│   ├── analytics.ts                # GA4 Data API wrapper — getAnalyticsReport(), mock/live routing
│   └── email.ts                    # Email abstraction (mock/test/live routing)
├── utils/
│   ├── logger.ts                   # Pino logger — exports log(), logError(), flush(). Never import pino directly.
│   └── email-preview.ts            # Mock mode: writes HTML to .email-preview/last.html
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel: export const functions = [...]
        ├── template.ts             # Canonical workflow template — copy, do not register
        ├── hello-world.ts          # Example stub function
        ├── weekly-analytics-scheduler.ts  # Cron (Tue 09:00 UTC) + manual trigger; fans out per-client events
        └── weekly-analytics-report.ts     # Per-client worker: fetch GA4 data, build + send email

scripts/
├── setup-db.ts                     # Idempotent table creation (npm run db:setup)
├── seed-data.ts                    # Insert test clients (npm run db:seed)
└── test-email-preview.ts           # Trigger mock email preview (npm run email:preview)

specs/                              # Feature specs, plans, research (per feature)
.specify/                           # Speckit tooling and templates
```

## Commands

```bash
npm run dev            # Start app server + Inngest Dev Server concurrently
npm run build          # Compile TypeScript to dist/
npm run type-check     # Type-check without emitting
npm run db:setup       # Create database tables (idempotent)
npm run db:seed        # Seed test client records
npm run email:preview  # Send a mock email and open the HTML preview in the browser
```

## Code Style

- TypeScript 5.x, CommonJS modules, ES2022 target, strict mode
- All Inngest functions use `inngest.createFunction` + `step.run()` for every discrete step
- Every workflow function is exported from `src/inngest/functions/index.ts`
- Named steps (descriptive human-readable strings) are required in all `step.run()` calls
- Environment config read exclusively via `src/lib/config.ts`
- All email sends route through `src/lib/email.ts` — never call Resend SDK directly
- All DB queries route through `src/lib/db.ts` — never call Neon/pg directly
- `@neondatabase/serverless` Pool requires `ws` + `neonConfig.webSocketConstructor = ws` on Node.js 20 (no native WebSocket until Node 22) — already configured in `src/lib/db.ts`
- See `.specify/memory/constitution.md` for full architectural rules

## E2E Email Testing (feature 010)

When adding a new Inngest email workflow, register it in the e2e test suite — **three files, always**:

1. **`tests/e2e/email/flow-map.ts`** — add an entry to `FLOW_MAP` with `patterns`, `event`, `eventData`, and `testFile`
2. **`tests/e2e/email/<flow-name>.test.ts`** — create the Vitest test file (copy `weekly-analytics.test.ts` as a template)
3. **`.github/workflows/e2e-email.yml`** — add the path filter to `detect-changes` and a conditional job for the new flow; add the new job to `ci-gate`'s `needs` array

Run locally with: `PREVIEW_URL=<url> INNGEST_EVENT_KEY_STAGING=<key> ... npm run test:e2e`

## Recent Changes
- 010-e2e-email-ci: Added automated e2e email testing pipeline — `tests/e2e/email/` + `.github/workflows/e2e-email.yml`
- 009-vercel-prod-deploy: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (ships `inngest/vercel` adapter — no new packages needed)
- 008-structured-logging: Replaced console.log logger with `pino` + Better Stack (`@logtail/pino`). `src/utils/logger.ts` exports `log()`, `logError()`, `flush()`. Dev: pino-pretty (colorized stdout). Non-dev+token: Better Stack. Non-dev+no token: stdout JSON fallback. `LOGTAIL_SOURCE_TOKEN` via `config.logtailToken`. Never import pino directly.


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
<!-- MANUAL ADDITIONS END -->
