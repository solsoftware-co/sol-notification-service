# Implementation Plan: Database Schema Migrations

**Branch**: `011-db-schema-migrations` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-db-schema-migrations/spec.md`

## Summary

Introduce a versioned, file-based migration system that replaces the ad-hoc `scripts/setup-db.ts` script. Schema changes will be defined as numbered `.sql` files in `db/migrations/`, applied in order by a lightweight custom runner (`scripts/migrate.ts`) with zero new production dependencies. Migration state is tracked in a `schema_migrations` table that the runner bootstraps automatically on first use.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@neondatabase/serverless ^1.x`, `ws ^8.x`, `tsx ^4.x` (all existing — zero new packages)
**Storage**: Neon PostgreSQL — adds `schema_migrations` tracking table
**Testing**: Vitest 2.x (existing)
**Target Platform**: Node.js script (local dev + CI/CD pipeline via `npm run db:migrate`)
**Project Type**: Developer tooling / migration runner within existing web-service repo
**Performance Goals**: Apply all pending migrations in under 5 seconds (SC-004)
**Constraints**: Zero new production dependencies (Constitution Principle VI)
**Scale/Scope**: ~10 migrations at PoC scale; naming supports up to 999

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ N/A | Migration runner is dev-time tooling, not a notification workflow. No Inngest function involved. |
| II — Multi-Environment Safety | ✅ PASS | Runner reads `DATABASE_URL` via existing config infrastructure. Each environment uses its own URL — no code changes needed across envs. |
| III — Multi-Tenant by Design | ✅ N/A | Schema management is project-wide, not per-client. |
| IV — Observability by Default | ✅ PASS | Runner will produce structured log output for each migration applied/skipped. Errors will include version name and SQL error detail. |
| V — AI-Agent Friendly | ✅ PASS | Spec exists. Migration files are plain SQL — universally readable without tool knowledge. |
| VI — Minimal Infrastructure | ✅ PASS | Zero new production dependencies. Runner built on existing `@neondatabase/serverless` + `tsx`. No Docker, no migration CLI binary. |

**Complexity Tracking**: No violations — table not required.

## Project Structure

### Documentation (this feature)

```text
specs/011-db-schema-migrations/
├── plan.md              # This file
├── research.md          # Technology and approach decisions
├── data-model.md        # schema_migrations entity + initial migration content
├── quickstart.md        # Developer guide: create, apply, inspect migrations
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
db/
└── migrations/
    ├── V001__initial_schema.sql       # NEW — codifies clients + notification_logs tables
    └── (future migration files)

scripts/
├── migrate.ts                       # NEW — migration runner (apply + status)
├── setup-db.ts                      # DEPRECATED — replaced by migration system
├── seed-data.ts                     # UNCHANGED
└── test-email-preview.ts            # UNCHANGED

package.json                         # MODIFIED — add db:migrate, db:migrate:status; remove db:setup

.github/workflows/
└── ci.yml                           # MODIFIED — add migrate-check (PR) + migrate-deploy (main) jobs
```

**Structure Decision**: Single-project layout (Option 1). Migration files live under `db/migrations/` (separate from `scripts/` to distinguish schema definitions from executable scripts). Runner lives in `scripts/` consistent with existing `setup-db.ts`, `seed-data.ts` pattern.

## Architecture

### Migration Runner (`scripts/migrate.ts`)

The runner is a single TypeScript script invoked directly via `tsx`. It has two modes:

**Apply mode** (`npm run db:migrate`):
1. Bootstrap: `CREATE TABLE IF NOT EXISTS schema_migrations (...)`
2. Discover: read all `*.sql` files from `db/migrations/`, sort lexicographically
3. Diff: query `schema_migrations` to find which versions are already applied
4. Execute: for each pending migration, in order:
   - Begin transaction
   - Execute SQL file content
   - Insert version record into `schema_migrations`
   - Commit (or rollback + surface error on failure)
5. Report: log count of applied migrations; exit 0 on success, 1 on failure

**Status mode** (`npm run db:migrate:status`):
1. Bootstrap: `CREATE TABLE IF NOT EXISTS schema_migrations (...)` (safe to re-run)
2. Discover: same as above
3. Compare: join discovered files against applied versions
4. Print: one line per migration — `✓ applied` or `○ pending` — with applied timestamp
5. Exit 0 (status command never applies changes)

### SQL File Format

Each migration file contains raw PostgreSQL SQL. The runner wraps execution in a transaction — authors do not need to include `BEGIN`/`COMMIT`.

```
db/migrations/V###__description.sql
```

Example:
```sql
-- V001__initial_schema.sql
-- Establishes the baseline schema for the notification service.

CREATE TABLE IF NOT EXISTS clients ( ... );
CREATE TABLE IF NOT EXISTS notification_logs ( ... );
```

### Transaction Atomicity

Each migration is executed inside a single `BEGIN` / `COMMIT` block using the existing `@neondatabase/serverless` Pool connection. If the SQL fails, the transaction is rolled back and no version record is written. The migration is left in "pending" state and can be corrected and re-applied.

### Backward Compatibility (Existing Databases)

Developers who have already run `npm run db:setup` will have `clients` and `notification_logs` present. Migration `V001__initial_schema.sql` uses `CREATE TABLE IF NOT EXISTS` for both tables — it will succeed without error and be recorded as applied. The migration system is safe to introduce into existing environments without data loss or errors.

### Deprecation of `setup-db.ts`

`scripts/setup-db.ts` will remain in the codebase but its `db:setup` npm script entry will be removed and replaced by `db:migrate`. The file will be marked with a deprecation comment pointing to the new system.

## Implementation Phases

### Phase A — Infrastructure

1. Create `db/migrations/` directory
2. Write `V001__initial_schema.sql` with existing `clients` + `notification_logs` DDL (with `IF NOT EXISTS` guards)
3. Write `scripts/migrate.ts` — migration runner (apply + status modes)
4. Update `package.json`: add `db:migrate` and `db:migrate:status` scripts; remove `db:setup`
5. Deprecate `scripts/setup-db.ts` (add comment; do not delete yet)

### Phase B — Testing

6. Write unit tests for the migration runner logic:
   - Test: fresh database → all migrations applied
   - Test: already-applied migrations → skipped (idempotency)
   - Test: `--status` flag → no writes, correct output
   - Test: failing SQL → transaction rolled back, no version record written

### Phase C — CI/CD Integration

7. Add a `migrate-check` job to `.github/workflows/ci.yml`:
   - Trigger: only on PRs that change files matching `db/migrations/**`
   - Uses a `postgres` GitHub Actions service container (ephemeral, no credentials needed) to test migrations in isolation
   - Runs `db:migrate` against the ephemeral database and asserts exit 0
   - Failure blocks the PR merge
8. Add a `migrate-deploy` job to `.github/workflows/ci.yml` (push to main only):
   - Runs after `type-check` and `test` pass
   - Runs `db:migrate` against the production `DATABASE_URL` (stored as `PROD_DATABASE_URL` GitHub secret)
   - Failure halts the workflow — application deployment does not proceed
   - Only runs when `db/migrations/**` files changed (path filter) to avoid unnecessary production DB connections
9. Ensure deployment step (Vercel or otherwise) `needs: [migrate-deploy]` so schema is always ahead of code

### Phase D — Documentation & Validation

10. Update `CLAUDE.md` "Commands" section: replace `db:setup` with `db:migrate`
11. Verify end-to-end: fresh Neon dev branch → `db:migrate` → seed → `dev` server works
12. Update the e2e email CI workflow if it references `db:setup`

## CI/CD Architecture

### PR Validation Flow

```
PR opened / updated
       │
       ▼
changed files include db/migrations/**?
       │
  YES  │   NO → skip (job succeeds immediately)
       ▼
spin up ephemeral postgres (GitHub Actions service)
       │
       ▼
npm run db:migrate (against ephemeral DB)
       │
  exit 0 → ✓ PR check passes
  exit 1 → ✗ PR check fails, merge blocked
```

### Merge-to-Main Flow

```
Merge to main
       │
       ▼
type-check + test jobs pass
       │
       ▼
migrate-deploy job
  (only if db/migrations/** changed)
       │
       ├─ runs db:migrate against PROD_DATABASE_URL
       │
  exit 0 → ✓ schema updated
  exit 1 → ✗ pipeline fails; deploy blocked
       │
       ▼
application deployment (Vercel)
  (needs: migrate-deploy)
```

### Key Sequencing Decision

Migration runs **before** deployment. This means migration files must be backwards-compatible with the currently-deployed application code for the brief window between migration completion and the new code going live. In practice at this scale, this window is seconds and the rule is simple: never drop a column or table in the same migration that introduces its replacement — do it in a subsequent migration after the new code is deployed.

## Open Questions

None — all decisions resolved in `research.md` and above architecture.
