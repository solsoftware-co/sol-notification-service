# sol-notificaiton-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-23

## Active Technologies
- TypeScript 5.x / Node.js 20+ + All from 002 — `inngest ^3.x`, `@neondatabase/serverless`, `resend`, `ws`, `tsx` (003-form-notification)
- No new tables — reads `clients` table via existing `getClientById()` (003-form-notification)
- N/A — no database schema changes; all DB calls replaced with `vi.fn()` stubs (feature/004-testing-ci)

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
- feature/004-testing-ci: Added TypeScript 5.x / Node.js 20+
- 003-form-notification: Added TypeScript 5.x / Node.js 20+ + All from 002 — `inngest ^3.x`, `@neondatabase/serverless`, `resend`, `ws`, `tsx`
- 002-core-infrastructure: Added TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (existing), `@neondatabase/serverless ^0.9.x` (to install), `resend ^3.5.0` (existing), `tsx ^4.x` (existing)


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
