# Data Model: Database Schema Migrations

**Feature**: 011-db-schema-migrations
**Date**: 2026-03-11

---

## New Database Entity: `schema_migrations`

This table is the migration tracking record. It is created automatically by the runner on first execution.

```
schema_migrations
├── version    TEXT        PRIMARY KEY   -- Migration file stem, e.g. "001_initial_schema"
└── applied_at TIMESTAMPTZ NOT NULL      -- When migration was applied (DEFAULT NOW())
```

**Constraints**:
- `version` is the primary key — prevents duplicate application
- `applied_at` uses `DEFAULT NOW()` — no application-layer timestamp logic needed
- No foreign keys — this table is self-contained; it has no dependency on other tables

**Invariants**:
- A row exists IFF the corresponding migration file was successfully applied (full transaction committed)
- Version values are deterministic: they match the SQL filename without the `.sql` extension
- Rows are never updated or deleted — the table is append-only

---

## Migration File Entity

Not a database table — a versioned file artifact stored in the codebase.

```
Migration File
├── version        (V### — "V" prefix + 3-digit zero-padded number, Flyway standard)
├── name           (snake_case description, e.g. "initial_schema")
├── filename       ("V" + version + "__" + name + ".sql", e.g. "V001__initial_schema.sql")
├── location       db/migrations/<filename>
└── content        (valid PostgreSQL DDL/DML SQL)
```

**Ordering rule**: Migration files are sorted lexicographically by filename. The `V###__` prefix (Flyway convention) guarantees correct ordering up to 999 migrations and is instantly recognizable across the industry.

**Immutability rule**: Once a migration file is applied to any environment, its content MUST NOT be modified. To change a previously-applied schema, create a new migration file.

---

## Initial Migration Content (`V001__initial_schema.sql`)

This migration codifies the schema currently produced by `scripts/setup-db.ts`. It replaces that script as the authoritative schema definition.

```sql
-- V001__initial_schema.sql
-- Establishes the baseline schema for the notification service.
-- Replaces scripts/setup-db.ts as the authoritative schema definition.

CREATE TABLE IF NOT EXISTS clients (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  ga4_property_id TEXT        NULL,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  settings        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id          BIGSERIAL   PRIMARY KEY,
  client_id   TEXT        NOT NULL REFERENCES clients(id),
  workflow    TEXT        NOT NULL,
  event_name  TEXT        NOT NULL,
  outcome     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## State Transition Diagram

```
Fresh DB
   │
   ▼
[db:migrate runs]
   │
   ├─ schema_migrations table missing?
   │   └─ CREATE TABLE schema_migrations
   │
   ▼
For each .sql file in db/migrations/ (sorted):
   │
   ├─ version already in schema_migrations?
   │   └─ SKIP (already applied)
   │
   └─ version NOT in schema_migrations?
       ├─ BEGIN transaction
       ├─ Execute SQL content
       ├─ INSERT INTO schema_migrations (version)
       ├─ COMMIT  ──────────────────────▶  [Applied state]
       └─ ROLLBACK on error  ────────────▶  [Failed state — no record written]
```
