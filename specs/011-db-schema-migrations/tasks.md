# Tasks: Database Schema Migrations

**Input**: Design documents from `/specs/011-db-schema-migrations/`
**Prerequisites**: plan.md ✓ spec.md ✓ research.md ✓ data-model.md ✓ quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Create the directory structure that the migration system depends on.

- [x] T001 Create `db/migrations/` directory at repo root

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Codify the existing schema as the baseline migration. This must exist before the runner is meaningful and before any future migrations can build on it.

**⚠️ CRITICAL**: T001 must be complete. No user story work can begin until this phase is complete.

- [x] T002 Write `db/migrations/V001__initial_schema.sql` — copy `clients` and `notification_logs` DDL from `scripts/setup-db.ts`; use `CREATE TABLE IF NOT EXISTS` guards on both tables so the migration is safe to apply against databases that already have these tables (existing dev environments)

**Checkpoint**: Baseline migration file exists — runner implementation can now begin.

---

## Phase 3: User Stories 1 & 2 — Apply Migrations / Bootstrap Fresh DB (Priority: P1, P2) 🎯 MVP

**Goal**: A developer can run `npm run db:migrate` to apply all pending migrations in order against any database — fresh or pre-existing.

**Note on US2**: User Story 2 (bootstrap fresh database) is fully delivered by this phase. The runner's self-bootstrapping step (`CREATE TABLE IF NOT EXISTS schema_migrations`) is what makes it safe on a completely empty database — no separate implementation phase is needed.

**Independent Test (US1)**: Create a second migration file (e.g., `V002__add_test_column.sql`), run `npm run db:migrate`, verify the column exists in the database and both versions appear in `schema_migrations`. Run again — verify nothing re-executes.

**Independent Test (US2)**: Point `DATABASE_URL` at a completely empty Neon dev branch, run `npm run db:migrate`, verify `schema_migrations`, `clients`, and `notification_logs` all exist. No manual setup steps.

### Implementation

- [x] T003 Implement `scripts/migrate.ts` — apply mode with the following behavior:
  1. **Bootstrap**: `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` — runs on every invocation, safe to re-run
  2. **Discover**: read all `*.sql` files from `db/migrations/` using `fs.promises.readdir`, sort lexicographically
  3. **Diff**: `SELECT version FROM schema_migrations` to get applied set; subtract from discovered files to get pending list
  4. **Apply loop**: for each pending migration in order — `BEGIN`, execute file content via `db.query()`, `INSERT INTO schema_migrations (version) VALUES ($1)`, `COMMIT`; on any error `ROLLBACK`, log the error with version name and SQL error detail, `process.exit(1)`
  5. **Logging**: log each applied migration as `[migrate] ✓ applied V001__initial_schema`; on completion log `[migrate] N migration(s) applied` or `[migrate] Already up to date` if none pending
  6. Use the existing `db` Pool from `src/lib/db.ts` and `config` from `src/lib/config.ts` — do not create new connections
- [x] T004 [P] Update `package.json` scripts: add `"db:migrate": "tsx --env-file .env.local scripts/migrate.ts"`, remove the `"db:setup"` entry
- [x] T005 [P] Add deprecation comment to top of `scripts/setup-db.ts`: `// DEPRECATED: Replaced by the migration system. Use 'npm run db:migrate' instead. See db/migrations/V001__initial_schema.sql.`

**Checkpoint**: `npm run db:migrate` is fully functional. US1 and US2 are independently testable.

---

## Phase 4: User Story 3 — Inspect Migration Status (Priority: P3)

**Goal**: A developer can run `npm run db:migrate:status` to see which migrations have been applied and which are pending — without touching the database schema.

**Independent Test**: With one migration applied and one pending, run `npm run db:migrate:status`, verify output lists the applied migration with a `✓` and timestamp, and the pending migration with a `○`. Verify no writes occurred (row count in `schema_migrations` unchanged).

### Implementation

- [x] T006 Add `--status` mode to `scripts/migrate.ts`: when `process.argv.includes('--status')`, after bootstrap and discovery steps, print one line per migration — `✓ <version>   applied <ISO timestamp>` for applied, `○ <version>   pending` for pending — then print summary `X applied, Y pending` and exit 0 without executing any migrations
- [x] T007 [P] Add `"db:migrate:status": "tsx --env-file .env.local scripts/migrate.ts --status"` to `package.json` scripts

**Checkpoint**: Both `db:migrate` and `db:migrate:status` are functional. US1, US2, and US3 are complete.

---

## Phase 5: User Story 4 — CI Validation on PR (Priority: P4)

**Goal**: Every PR that touches `db/migrations/**` is automatically validated — a broken migration SQL blocks the merge.

**Independent Test**: Open a PR adding a migration file with `INVALID SQL HERE;`, verify the `migrate-check` CI job fails and the merge is blocked. Fix the SQL, push again, verify `migrate-check` passes.

### Implementation

- [x] T008 Add `migrate-check` job to `.github/workflows/ci.yml` with the following structure:
  - `on: pull_request` trigger with `paths: ['db/migrations/**']` filter so it only runs when migration files change
  - `services:` block declaring a `postgres:15` container with `POSTGRES_PASSWORD: postgres`, `POSTGRES_DB: migrate_test`, health check via `pg_isready`
  - Step: `npm ci`
  - Step: set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/migrate_test` as an env var
  - Step: `npm run db:migrate` — asserts exit 0; any non-zero exit causes the job to fail and blocks the PR
  - Job name: `Validate Migrations`

**Checkpoint**: Broken migration SQL is caught in CI before it can reach main.

---

## Phase 6: User Story 5 — Auto-Apply Migrations on Merge to Main (Priority: P5)

**Goal**: When a branch with new migration files merges to main, the pipeline automatically applies those migrations to the production database before Vercel deploys the new code.

**Independent Test**: Merge a branch containing a new migration file to main, verify the migration appears in `schema_migrations` on the production database within the pipeline run — with no manual `db:migrate` command having been run.

### Implementation

- [x] T009 Add `migrate-deploy` job to `.github/workflows/ci.yml` with the following structure:
  - `on: push` with `branches: [main]` and `paths: ['db/migrations/**']` filter
  - `needs: [type-check, test]` — only runs after existing CI jobs pass
  - Step: `npm ci`
  - Step: `npm run db:migrate` with `DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}` as env var
  - Any failure exits non-zero and halts the workflow — downstream deployment does not proceed
  - Job name: `Deploy Migrations`
  - Add a comment in the job noting the Two-Deploy Rule: destructive changes (column drops, renames) must be split across two PRs — see `specs/011-db-schema-migrations/quickstart.md`

**Checkpoint**: Schema changes deploy automatically and always precede code deployment.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T010 [P] Update `CLAUDE.md` Commands section: replace `npm run db:setup` with `npm run db:migrate` and add `npm run db:migrate:status`
- [x] T011 [P] Check `.github/workflows/e2e-email.yml` for any reference to `db:setup` or `setup-db`; replace with `db:migrate` if found
- [x] T012 End-to-end validation on a fresh Neon dev branch: run `npm run db:migrate`, then `npm run db:seed`, then `npm run dev` — verify the server starts, connects to the database, and existing workflows function correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001
- **US1+US2 (Phase 3)**: Depends on T002 — BLOCKS phases 4, 5, 6
- **US3 (Phase 4)**: Depends on Phase 3 complete (T003 must exist to extend)
- **US4 (Phase 5)**: Depends on Phase 3 complete (runner must work before CI can invoke it)
- **US5 (Phase 6)**: Depends on Phase 5 complete (deploy job should be added alongside the check job)
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1+US2 (P1, P2)**: Can start after T002 — no other story dependencies
- **US3 (P3)**: Depends on US1+US2 complete (extends the same `scripts/migrate.ts`)
- **US4 (P4)**: Depends on US1+US2 complete (CI invokes the runner)
- **US5 (P5)**: Depends on US4 (logically paired; both are jobs in the same workflow file)

### Within Each Phase

- T004, T005 are parallel to each other but depend on T003 existing (same PR)
- T007 is parallel to T006 but depends on the flag existing
- T010, T011 are fully parallel in Phase 7

### Parallel Opportunities

```bash
# Phase 3 — after T003 is written:
T004: Update package.json (db:migrate script)
T005: Deprecate setup-db.ts
# Both touch different files — run in parallel

# Phase 4 — after T006 is written:
T007: Update package.json (db:migrate:status script)
# Single task, no parallelism needed

# Phase 7 — fully parallel:
T010: Update CLAUDE.md
T011: Update e2e-email.yml
```

---

## Implementation Strategy

### MVP (User Stories 1 & 2 only — Phases 1–3)

1. Phase 1: Create `db/migrations/` directory
2. Phase 2: Write `V001__initial_schema.sql`
3. Phase 3: Write runner, update package.json, deprecate setup-db.ts
4. **STOP and VALIDATE**: Run `db:migrate` against a fresh branch — verify it creates all tables and records the migration. Run again — verify idempotency.
5. Ship: team members can now create migration files and apply them locally

### Incremental Delivery

1. MVP (Phases 1–3) → Manual migration management works ✓
2. Add Phase 4 (US3) → Status visibility added ✓
3. Add Phase 5 (US4) → Broken migrations caught in CI ✓
4. Add Phase 6 (US5) → Auto-deploy on merge ✓
5. Phase 7 polish → Docs and CI updated ✓

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies — safe to parallelize
- T003 is the largest single task (~70 lines TypeScript) — keep it focused on the runner loop; no business logic
- The `db` Pool from `src/lib/db.ts` requires `DATABASE_URL` in env — the runner inherits this from the `.env.local` file via `tsx --env-file`
- US2 requires no separate implementation phase — the `CREATE TABLE IF NOT EXISTS schema_migrations` at the top of T003 is what makes the runner safe on a fresh database
- For T008/T009: the existing `ci.yml` has `type-check` and `test` jobs — add the new jobs to the same file without modifying the existing jobs
