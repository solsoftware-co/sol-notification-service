# Feature Specification: Database Schema Migrations

**Feature Branch**: `011-db-schema-migrations`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "As you can see in my project, I'm using a data store. And right now, the tables and their respective schemas are very easy to maintain because they're pretty simple. However, as I continue to build out this project, I imagine that these tables and their schemas will become more complicated and difficult to manage. I want a way to manage these database tables and their schemas in an IAC fashion where it's defined as code so that this knowledge is not tribal but rather lives in the codebase and can easily be accessible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply Pending Migrations to a Database (Priority: P1)

A developer needs to evolve the database schema — adding a new table, adding a column, or modifying a constraint. They define the change as a versioned migration file checked into the codebase, then run a single command to apply all unapplied changes to the target database.

**Why this priority**: This is the core capability of the feature. Without it, nothing else works. Every schema change in the project's future depends on this flow working reliably.

**Independent Test**: Can be fully tested by creating a migration file, running the apply command against a test database, and verifying the schema change is present and the migration is recorded as applied.

**Acceptance Scenarios**:

1. **Given** a migration file exists that has not been applied, **When** the developer runs the apply command, **Then** the migration is executed and the schema change is reflected in the database.
2. **Given** the apply command has already been run, **When** the developer runs it again, **Then** no migrations are re-executed and the schema remains unchanged.
3. **Given** multiple unapplied migrations exist, **When** the developer runs the apply command, **Then** all pending migrations are applied in the correct order.
4. **Given** a migration file contains an error, **When** the apply command is run, **Then** the migration fails with a clear error message and no partial changes are committed to the database.

---

### User Story 2 - Bootstrap a Fresh Database Environment (Priority: P2)

A developer sets up a brand-new environment (local machine, staging, production) and needs to bring the database schema to the latest state without any manual SQL steps or knowledge of what has changed over time.

**Why this priority**: This enables reproducibility and removes the "it works on my machine" problem for schema state. It is foundational for onboarding, CI/CD, and multi-environment deployments.

**Independent Test**: Can be fully tested by pointing at a completely empty database, running the apply command, and verifying the final schema matches the expected current state.

**Acceptance Scenarios**:

1. **Given** an empty database with no tables, **When** the developer runs the apply command, **Then** all migrations are applied in order and the database matches the current expected schema.
2. **Given** a database with some migrations already applied, **When** the apply command is run, **Then** only the missing migrations are applied — previously applied ones are skipped.

---

### User Story 3 - Inspect Migration Status (Priority: P3)

A developer wants to understand the current state of the database schema — which migrations have been applied and which are still pending — without making any changes.

**Why this priority**: Observability into schema state is essential for debugging environment inconsistencies, auditing deployments, and planning future changes safely.

**Independent Test**: Can be fully tested by running the status command and comparing its output against the known set of migration files and the database's migration history.

**Acceptance Scenarios**:

1. **Given** a database where some migrations are applied and some are not, **When** the developer runs the status command, **Then** the output clearly distinguishes applied migrations from pending ones.
2. **Given** a fresh database with no migrations applied, **When** the developer runs the status command, **Then** all migrations are listed as pending.
3. **Given** a fully up-to-date database, **When** the developer runs the status command, **Then** all migrations are listed as applied and no pending migrations are shown.

---

### User Story 4 - Validate Migrations in CI Before Merge (Priority: P4)

When a pull request introduces new migration files, the CI pipeline automatically applies those migrations against an isolated test database and verifies they succeed. A PR with a broken migration cannot be merged.

**Why this priority**: Catches SQL errors, syntax mistakes, and logical conflicts before they ever reach the main branch — let alone a production database. This is the safety net that makes the migration system trustworthy at scale.

**Independent Test**: Can be fully tested by opening a PR that adds a migration file with intentionally invalid SQL and verifying that CI fails and blocks the merge. Then correct the SQL and verify CI passes.

**Acceptance Scenarios**:

1. **Given** a PR adds a new migration file with valid SQL, **When** CI runs, **Then** the migration validation job succeeds and does not block the merge.
2. **Given** a PR adds a new migration file with invalid SQL, **When** CI runs, **Then** the migration validation job fails with a clear error and blocks the merge.
3. **Given** a PR does not touch any migration files, **When** CI runs, **Then** the migration validation job is skipped (no unnecessary overhead).
4. **Given** a PR adds a migration that conflicts with the current schema (e.g., creating a table that already exists without `IF NOT EXISTS`), **When** CI runs, **Then** the validation job fails and surfaces the conflict before merge.

---

### User Story 5 - Auto-Apply Migrations on Merge to Main (Priority: P5)

When a branch containing new migration files is merged into main, the pipeline automatically applies those migrations to the production database before the new application code becomes live — without any manual intervention from a developer.

**Why this priority**: Eliminates the human step of remembering to run migrations after a merge. Ensures schema changes and code changes are always in sync at deployment time. Enables true continuous delivery for schema changes.

**Independent Test**: Can be fully tested by merging a branch with a new migration file, then verifying the migration was applied to the production database and recorded in `schema_migrations` — with no manual command having been run.

**Acceptance Scenarios**:

1. **Given** a branch with a new migration file is merged to main, **When** the pipeline runs, **Then** the migration is applied to the production database automatically.
2. **Given** a merge to main contains no migration file changes, **When** the pipeline runs, **Then** the auto-apply step is skipped (no unnecessary database connections or commands).
3. **Given** a migration fails during the auto-apply step, **When** the pipeline runs, **Then** the deployment of new application code is blocked — preventing a mismatch between schema state and code expectations.
4. **Given** the auto-apply step completes successfully, **When** the pipeline runs, **Then** the new application code is deployed with the updated schema already in place.

---

### Edge Cases

- What happens if two developers create migrations with conflicting version numbers (e.g., both create migration 005)?
- How does the system handle a migration that partially succeeds before failing mid-way?
- What happens if the migration tracking table itself is missing or corrupted in an otherwise populated database?
- How does the system behave if migration files are deleted from the codebase after already being applied?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Schema changes MUST be defined as discrete, sequentially-versioned migration files stored in the codebase.
- **FR-002**: The system MUST track which migrations have been applied so that each migration is executed at most once per database.
- **FR-003**: Migrations MUST be applied in a deterministic, version-ordered sequence.
- **FR-004**: A single command MUST apply all pending (unapplied) migrations to the target database.
- **FR-005**: Each migration execution MUST be atomic — if a migration fails, no partial changes are committed to the database.
- **FR-006**: A status command MUST allow developers to inspect which migrations have been applied and which are pending without modifying the database.
- **FR-007**: The apply command MUST be idempotent — running it multiple times produces the same result as running it once.
- **FR-008**: The system MUST integrate with the existing developer workflow as a first-class command runnable from the project root, consistent with how other developer tasks (database setup, seeding, previews) are invoked today.
- **FR-009**: Migration files MUST be human-readable and reviewable in a standard code review process.
- **FR-010**: The migration tracking mechanism MUST be self-bootstrapping — a fresh database requires no manual setup before running migrations for the first time.
- **FR-011**: The CI pipeline MUST automatically validate migration files against an isolated test database on every pull request that modifies files in the migrations directory.
- **FR-012**: A failing migration validation MUST block a pull request from being merged.
- **FR-013**: Migration validation in CI MUST NOT run when a pull request contains no migration file changes.
- **FR-014**: On every merge to the main branch, the pipeline MUST automatically apply any pending migrations to the production database before new application code is deployed.
- **FR-015**: If the automated migration step fails on merge to main, the application deployment MUST be blocked to prevent a schema/code version mismatch.

### Key Entities

- **Migration File**: A versioned, ordered unit of schema change stored in the codebase. Contains the instructions needed to advance the schema from one state to the next. Identified by a sequential version number and a descriptive name.
- **Migration Record**: A persisted record in the database that tracks which migration files have been applied, when they were applied, and whether they succeeded. Prevents re-execution of already-applied migrations.
- **Schema State**: The current structure of all database tables, columns, constraints, and indexes. At any point, the schema state is the cumulative result of all applied migrations in order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior knowledge of the project's schema history can bring a fresh database to the current schema state in under 2 minutes using a single command.
- **SC-002**: All current and future schema changes are fully represented in versioned files in the codebase — zero schema knowledge exists only in a developer's head or in undocumented SQL.
- **SC-003**: The full schema history is auditable via standard version control — every change has an author, timestamp, and associated commit.
- **SC-004**: Running the apply command against an already up-to-date database completes in under 5 seconds with no errors.
- **SC-005**: A new team member can understand the complete evolution of the database schema by reading the migration files in order without consulting any other documentation.
- **SC-006**: A pull request with a broken migration is caught automatically in CI — zero broken migrations can reach the main branch undetected.
- **SC-007**: Merged schema changes are live in the production database within the same pipeline run as the application deployment, with no manual intervention required.

## Assumptions

- The project currently has at least one existing table (clients) defined via the `scripts/setup-db.ts` script. The first migration will codify this existing schema, replacing the ad-hoc setup script as the authoritative source of truth.
- Developers are expected to create one migration per logical schema change — unrelated changes are not batched into a single migration.
- Rollback (down) migrations are out of scope for this feature; forward-only migrations are sufficient given the project's current scale. This assumption can be revisited in a future feature.
- The migration system will be used across all environments (local dev, staging, production) with environment-specific database URLs sourced from the existing config infrastructure.
- Because migrations run before deployment (FR-014), all migration files must be backwards-compatible with the currently-deployed application code. Destructive changes (column drops, renames, type changes) must be split across two deploys — detailed in the Two-Deploy Rule in `quickstart.md`.
