# Quickstart: Database Schema Migrations

**Feature**: 011-db-schema-migrations

---

## First-time setup

Run all migrations against your database (creates all tables from scratch on a fresh DB):

```bash
npm run db:migrate
```

---

## Check migration status

See which migrations have been applied and which are pending:

```bash
npm run db:migrate:status
```

Example output:
```
[migrate] Checking migration status...
[migrate] ✓ 001_initial_schema   applied 2026-03-11T09:00:00Z
[migrate] ○ 002_add_client_tier  pending
[migrate] 1 applied, 1 pending
```

---

## Apply pending migrations

Same command as first-time setup — it only runs what hasn't been applied yet:

```bash
npm run db:migrate
```

---

## Create a new migration

1. Add a new `.sql` file to `db/migrations/` following the naming convention:
   ```
   db/migrations/V###__description.sql
   ```
   Where `###` is the next available 3-digit zero-padded number (e.g. `V002`, `V003`).

2. Write valid PostgreSQL DDL/DML in the file. Wrap in `BEGIN`/`COMMIT` is **not** needed — the runner handles transactions automatically.

3. Run `npm run db:migrate` to apply it.

**Example**: Adding a `tier` column to `clients`:

```
db/migrations/V002__add_client_tier.sql
```

```sql
-- V002__add_client_tier.sql
-- Adds a tier field to clients for segmenting notification schedules.

ALTER TABLE clients
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard';
```

---

## Rules for migration files

- **Never edit an applied migration.** Once a migration is in the database, modifying its file will not re-run it. Create a new migration instead.
- **One logical change per file.** Do not batch unrelated schema changes into one migration.
- **Use `IF NOT EXISTS` / `IF EXISTS` guards** for idempotent operations where appropriate (especially in `V001__initial_schema.sql` which may run against databases that already have these tables).
- **Most DDL is transactional in PostgreSQL.** `CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN`, `DROP COLUMN`, `CREATE INDEX` (non-concurrent) are all safe inside a transaction. `CREATE INDEX CONCURRENTLY` is NOT — add a `-- NOTE: non-transactional` comment if you need it.

---

## The Two-Deploy Rule (backwards-compatible migrations)

Because the CI/CD pipeline applies migrations **before** the new application code is deployed, there is a brief window where the old code runs against the new schema. This means migrations must always be safe for the currently-deployed code to run against.

**Safe in a single migration** — old code is unaffected:
- Adding a new table
- Adding a nullable column (old code ignores it)
- Adding an index
- Loosening a constraint

**Requires two separate deploys** — old code would break if these ran before it was replaced:
- Dropping a column or table
- Renaming a column
- Making a nullable column non-nullable
- Changing a column's data type

**How to handle a rename or drop safely:**

Split it across two PRs:

| Deploy | Migration | What it does |
|--------|-----------|-------------|
| 1 | `V005__add_email_address_column.sql` | Add the new `email_address` column; backfill data from `email` |
| 2 | `V006__drop_email_column.sql` | Drop the old `email` column (safe — new code is already live) |

Between deploy 1 and deploy 2, both columns exist. The new code writes to `email_address`; the old code (briefly, during deploy 1's rollout) reads from `email`. No errors.

> **Rule of thumb**: If a migration removes or renames something, ask yourself: "Would the currently-deployed code break if this ran right now?" If yes, split it into two deploys.

---

## Environments

`db:migrate` uses the `DATABASE_URL` from your `.env.local` file. Each environment has its own database URL — the same command works for local dev, CI, staging, and production by supplying the appropriate `DATABASE_URL`.

CI/CD pipelines should run `npm run db:migrate` before starting the application to ensure the schema is current.
