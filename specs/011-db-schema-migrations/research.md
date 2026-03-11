# Research: Database Schema Migrations

**Feature**: 011-db-schema-migrations
**Date**: 2026-03-11

---

## Decision 1: Library vs. Custom Runner

**Decision**: Build a custom, zero-new-dependency migration runner using existing stack.

**Rationale**: Constitution Principle VI prohibits new infrastructure without a governance amendment. The project already has everything needed: `@neondatabase/serverless` for query execution, `tsx` for script execution, and `fs`/`path` (Node.js built-ins) for file traversal. A custom runner for forward-only SQL migrations is ~70 lines of TypeScript — well within scope and far simpler than onboarding a migration library.

**Alternatives considered**:

| Option | Why Rejected |
|--------|-------------|
| `node-pg-migrate` | New dependency; would require governance amendment; TypeScript support is secondary (primarily JS-first) |
| `umzug` | New dependency; Sequelize-heritage; adds ~200KB for functionality we don't need beyond the runner loop |
| `@vercel/postgres` migrations | Not a standalone migration tool; tightly coupled to Vercel's Postgres product, not Neon |
| Flyway / Liquibase | JVM tools; incompatible with Node.js script workflow; require Docker or separate runtime |
| Custom runner | Zero new deps; fits existing `scripts/*.ts` pattern; full control over behavior and error messages |

---

## Decision 2: Migration File Format

**Decision**: Plain `.sql` files in `db/migrations/`, named `V###__description.sql` (e.g., `V001__initial_schema.sql`).

**Rationale**: SQL files are universally readable, reviewable in code review without tooling knowledge, and directly executable against any PostgreSQL-compatible database. TypeScript migration files add complexity (must be compiled/executed, can import application code accidentally) with no benefit for DDL changes.

**Naming convention**: `V###__snake_case_description.sql` (Flyway standard)
- `V` prefix + zero-padded 3-digit number ensures correct lexicographic sort order and is instantly recognizable to any developer familiar with the industry-standard Flyway convention
- Double underscore (`__`) unambiguously separates the version number from the description (single underscore could be part of either component)
- If a migration tool like Flyway is ever adopted, files are already named correctly — zero migration cost
- 3-digit prefix supports up to 999 migrations (sufficient for PoC scale)

**Alternatives considered**:

| Format | Why Rejected |
|--------|-------------|
| `NNN_description.sql` (single underscore) | Non-standard; single underscore is ambiguous (could be part of version or description) |
| Timestamp prefix (`20260311120000_name.sql`) | Harder to read in directory listing; collision-resistant but overkill for a small team |
| TypeScript migration files | Requires `tsx` execution inside runner loop; risk of accidentally importing application modules |

---

## Decision 3: Migration Tracking

**Decision**: A `schema_migrations` table with `(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)`.

**Rationale**: Minimal schema sufficient for the feature requirements. `version` corresponds to the filename without extension (e.g., `001_initial_schema`). Storing the filename stem (not a full path) keeps records portable if the `db/migrations/` directory is ever moved.

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Self-bootstrapping**: The runner creates this table before checking for pending migrations. No manual pre-setup is required on fresh databases.

---

## Decision 4: Atomicity

**Decision**: Wrap each migration in a `BEGIN` / `COMMIT` transaction. On error, `ROLLBACK` and surface the error — do not record the migration as applied.

**Rationale**: PostgreSQL supports transactional DDL (unlike MySQL). `CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN`, etc., are all rollbackable. This guarantees no partial schema changes persist on failure.

**Known limitation**: `CREATE INDEX CONCURRENTLY` and `CREATE DATABASE` cannot run inside a transaction. If a future migration needs these, it should be split into a separate migration file and documented with a `-- NOTE: non-transactional` comment. The runner will still wrap it in `BEGIN`/`COMMIT` but Postgres will auto-commit the non-transactional statement — authors must be aware.

---

## Decision 5: Existing `setup-db.ts` Disposition

**Decision**: Deprecate `scripts/setup-db.ts` in favor of the migration system. The first migration (`001_initial_schema.sql`) will contain the existing `clients` and `notification_logs` DDL. The `db:setup` npm script will be replaced by `db:migrate`.

**Rationale**: `setup-db.ts` used `CREATE TABLE IF NOT EXISTS` which is idempotent but not versioned — it cannot track incremental changes. The migration system supersedes it entirely.

**Migration path**: Any developer who has already run `db:setup` will have the `clients` and `notification_logs` tables present. When they first run `db:migrate`, migration `001_initial_schema` will attempt to create these tables. Since `001_initial_schema.sql` will use `CREATE TABLE IF NOT EXISTS`, it will succeed without error and be recorded as applied.

---

## Decision 6: Developer Commands

**Decision**: Add two new npm scripts; remove `db:setup`.

```json
"db:migrate": "tsx --env-file .env.local scripts/migrate.ts",
"db:migrate:status": "tsx --env-file .env.local scripts/migrate.ts --status"
```

The `--status` flag prints applied/pending migration status without executing anything.
