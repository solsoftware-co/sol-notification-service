# sol-notificaiton-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-23

## Active Technologies

- TypeScript 5.x / Node.js 20+ + `inngest ^3.x` (runtime); `concurrently ^9.x`, `tsx ^4.x`, (001-inngest-dev-setup)

## Project Structure

```text
src/
├── index.ts                        # HTTP server entry point + Inngest serve handler
└── inngest/
    ├── client.ts                   # Inngest client (id: "notification-service")
    └── functions/
        ├── index.ts                # Barrel: export const functions = [...]
        └── hello-world.ts          # Example stub function

specs/                              # Feature specs, plans, research (per feature)
.specify/                           # Speckit tooling and templates
```

## Commands

```bash
npm run dev          # Start app server + Inngest Dev Server concurrently
npm run build        # Compile TypeScript to dist/
npm run type-check   # Type-check without emitting
```

## Code Style

- TypeScript 5.x, CommonJS modules, ES2022 target, strict mode
- All Inngest functions use `inngest.createFunction` + `step.run()` for every discrete step
- Every workflow function is exported from `src/inngest/functions/index.ts`
- Named steps (descriptive human-readable strings) are required in all `step.run()` calls
- Environment config read exclusively via `src/lib/config.ts` (to be added in future feature)
- See `.specify/memory/constitution.md` for full architectural rules

## Recent Changes

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
