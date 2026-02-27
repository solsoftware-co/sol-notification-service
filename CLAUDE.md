# sol-notificaiton-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-23

## Active Technologies
- TypeScript 5.x / Node.js 20+ + All from 002 — `inngest ^3.x`, `@neondatabase/serverless`, `resend`, `ws`, `tsx` (003-form-notification)
- No new tables — reads `clients` table via existing `getClientById()` (003-form-notification)

- TypeScript 5.x / Node.js 20+ + `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x`, `ws ^8.x`, `concurrently ^9.x`, `tsx ^4.x`
- Neon PostgreSQL via `@neondatabase/serverless` Pool (WebSocket transport)

## Project Structure

```text
src/
├── index.ts                        # HTTP server entry point + Inngest serve handler
├── types/
│   └── index.ts                    # All shared TypeScript types and event payload interfaces
├── lib/
│   ├── config.ts                   # Environment config singleton (single source of truth)
│   ├── db.ts                       # Neon Pool singleton + getClientById()
│   └── email.ts                    # Email abstraction (mock/test/live routing)
├── utils/
│   ├── logger.ts                   # Structured logger ([env] [clientId=...] prefix)
│   └── email-preview.ts            # Mock mode: writes HTML to .email-preview/last.html
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel: export const functions = [...]
        ├── template.ts             # Canonical workflow template — copy, do not register
        └── hello-world.ts          # Example stub function

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

## Recent Changes
- 003-form-notification: Added TypeScript 5.x / Node.js 20+ + All from 002 — `inngest ^3.x`, `@neondatabase/serverless`, `resend`, `ws`, `tsx`
- 002-core-infrastructure: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (existing), `@neondatabase/serverless ^0.9.x` (to install), `resend ^3.5.0` (existing), `tsx ^4.x` (existing)

- 001-inngest-dev-setup: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (runtime); `concurrently ^9.x`, `tsx ^4.x`,

<!-- MANUAL ADDITIONS START -->
## Git Conventions

### Branch Naming

All feature branches must follow this pattern:

```
feature/<spec-id>-<short-description>
```

Examples:
- `feature/001-inngest-dev-setup`
- `feature/002-email-notifications`
- `feature/003-webhook-handler`

The `<spec-id>` matches the directory name under `specs/`. Never create branches without the `feature/` prefix.
<!-- MANUAL ADDITIONS END -->
