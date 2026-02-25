# Task List: Core Shared Infrastructure

**Feature Branch**: `002-core-infrastructure`
**Generated**: 2026-02-25
**Source**: `plan.md`, `data-model.md`, `contracts/module-interfaces.md`, `research.md`

---

## Execution Summary

- **Total tasks**: 13
- **Phases**: 4 (Setup → Core Libraries → Database Scripts → Template + Integration)
- **Parallel tasks**: Marked [P] — can run concurrently within the same phase
- **TDD approach**: Types defined first (T-011) before any module that uses them

---

## Phase 0: Setup & Dependencies

### T-001: Install @neondatabase/serverless

- [X] Run `npm install @neondatabase/serverless`
- [X] Verify `@neondatabase/serverless` appears in `package.json` dependencies

**Files**: `package.json`

---

### T-002: Add database scripts to package.json

- [X] Add `"db:setup": "tsx --env-file .env.local scripts/setup-db.ts"` to scripts
- [X] Add `"db:seed": "tsx --env-file .env.local scripts/seed-data.ts"` to scripts

**Files**: `package.json`

---

### T-003: Create .env.local.example

- [X] Create `.env.local.example` documenting all env vars (DATABASE_URL, RESEND_API_KEY, RESEND_FROM, TEST_EMAIL, EMAIL_MODE, VERCEL_ENV)
- [X] Verify `.env.local` is already in `.gitignore`

**Files**: `.env.local.example`, `.gitignore`

---

## Phase 1: Core Library Modules

### T-011 [P]: Create src/types/index.ts

- [X] Define `AppEnv`, `EmailMode` union types
- [X] Define `AppConfig` interface
- [X] Define `ClientRow` interface (matches DB schema in data-model.md)
- [X] Define `NotificationLogRow` interface
- [X] Define `EmailRequest` interface
- [X] Define `EmailResult` interface
- [X] Define `BaseEventPayload` interface with `clientId: string`

**Files**: `src/types/index.ts`

---

### T-012 [P]: Create src/lib/config.ts

- [X] Read `VERCEL_ENV` → derive `AppEnv` (default: `'development'`)
- [X] Read `EMAIL_MODE` → derive `EmailMode` with env-based fallback (mock/test/live)
- [X] Read `TEST_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM`, `DATABASE_URL`
- [X] Throw at load time if `EMAIL_MODE` is not a recognized value
- [X] Throw at load time if `EMAIL_MODE=live` and `RESEND_API_KEY` missing
- [X] Throw at load time if `EMAIL_MODE=test` and `TEST_EMAIL` missing
- [X] Throw at load time if `DATABASE_URL` missing
- [X] Export `config: AppConfig` singleton

**Files**: `src/lib/config.ts`
**Depends on**: T-011

---

### T-013 [P]: Create src/utils/logger.ts

- [X] Import `config` from `src/lib/config.ts`
- [X] Implement `log(message, context?)` — prepends `[config.env]` and optional `[clientId=<id>]`
- [X] Implement `logError(message, error, context?)` — same prefix + error serialization
- [X] Export both functions

**Files**: `src/utils/logger.ts`
**Depends on**: T-012

---

### T-014: Create src/lib/db.ts

- [X] Create Neon `Pool` singleton using `config.databaseUrl` (max: 10, 30s idle, 5s connect timeout)
- [X] Attach `pool.on('error', ...)` handler
- [X] Export `query<T>()` helper wrapping `pool.query<T>()`
- [X] Implement `getClientById(id: string): Promise<ClientRow>`
  - [X] Throws `Error('Client not found: <id>')` if no row
  - [X] Throws `Error('Client inactive: <id>')` if `active = false`
- [X] Export `checkDbConnection()` that runs `SELECT 1` and logs result

**Files**: `src/lib/db.ts`
**Depends on**: T-011, T-012

---

### T-015: Create src/lib/email.ts

- [X] Import `config`, `log`, `writeEmailPreview`, Resend SDK
- [X] Initialize Resend client using `config.resendApiKey`
- [X] Implement `sendEmail(request: EmailRequest): Promise<EmailResult>`
  - [X] Validate `request.to` (non-empty, contains `@`) — throw if invalid
  - [X] `mock` mode: `log` to console, call `writeEmailPreview`, return `EmailResult` with `outcome: 'logged'`
  - [X] `test` mode: rewrite `to` to `config.testEmail`, prefix subject `[TEST: <original>]`, send via Resend
  - [X] `live` mode: send to original `to` via Resend
  - [X] On Resend API error: throw `Error('Resend error [<name>]: <message>')`
  - [X] Log all attempts (mode, originalTo, actualTo, subject, outcome)
- [X] Export `sendEmail`

**Files**: `src/lib/email.ts`
**Depends on**: T-011, T-012, T-013, T-016

---

### T-016: Create src/utils/email-preview.ts

- [X] Implement `writeEmailPreview(options: { to, subject, html })` as the sole export
- [X] `buildPreviewPage()` — wraps email HTML in a styled browser page with sticky metadata header (To, Subject, "mock — not sent" badge)
- [X] `openInBrowser()` — fires `open` on macOS, `xdg-open` on Linux, `start` on Windows (cmd.exe)
- [X] Write output to `.email-preview/last.html` (creates dir if missing, overwrites on each call)
- [X] Add `.email-preview/` to `.gitignore`

**Files**: `src/utils/email-preview.ts`, `.gitignore`
**Note**: Called only from `email.ts` mock branch — no env-specific logic lives in `email.ts`

---

## Phase 2: Database Scripts

### T-021: Create scripts/setup-db.ts

- [X] Import `db` from `src/lib/db.ts`
- [X] Run `CREATE TABLE IF NOT EXISTS clients (...)` — exact DDL from data-model.md
- [X] Run `CREATE TABLE IF NOT EXISTS notification_logs (...)` — exact DDL from data-model.md
- [X] Log each table creation step
- [X] Log "Setup complete" on success
- [X] Close pool connection on exit

**Files**: `scripts/setup-db.ts`
**Depends on**: T-014

---

### T-022: Create scripts/seed-data.ts

- [X] Import `db` from `src/lib/db.ts`
- [X] Insert `client-acme` (Acme Corp, test-acme@example.com, ga4_property_id='properties/123456789', active=true) with `ON CONFLICT (id) DO NOTHING`
- [X] Insert `client-globex` (Globex Inc, test-globex@example.com, ga4_property_id=NULL, active=true) with `ON CONFLICT (id) DO NOTHING`
- [X] Log each seeded client
- [X] Log "Seed complete — 2 clients available"
- [X] Close pool connection on exit

**Files**: `scripts/seed-data.ts`
**Depends on**: T-021

---

## Phase 3: Workflow Template

### T-031: Create src/inngest/functions/template.ts

- [X] Add file-level comment: "TEMPLATE — copy this file, do not register directly"
- [X] Import `inngest` client, `config`, `log`, `logError`, `getClientById`, `sendEmail`
- [X] Import `BaseEventPayload` from `src/types/index.ts`
- [X] Define function with event name `'template/triggered'` (clearly test-only)
- [X] `step.run('log-start', ...)` — log `config.env` and `clientId`
- [X] `step.run('fetch-client-config', ...)` — call `getClientById(event.data.clientId)`
- [X] `step.run('send-email', ...)` — call `sendEmail({ to: client.email, subject: '...', html: '...' })`
- [X] `step.run('log-result', ...)` — log outcome with clientId and env context
- [X] Export the function (but do NOT add to `src/inngest/functions/index.ts`)

**Files**: `src/inngest/functions/template.ts`
**Depends on**: T-011, T-012, T-013, T-014, T-015

---

## Phase 4: Integration & Validation

### T-041: Update src/index.ts startup

- [X] Import `config` from `src/lib/config.ts`
- [X] Import `checkDbConnection` from `src/lib/db.ts`
- [X] Import `log` from `src/utils/logger.ts`
- [X] Log `config.env` and `emailMode` on server start
- [X] Call `checkDbConnection()` after server starts listening

**Files**: `src/index.ts`
**Depends on**: T-012, T-013, T-014

---

### T-042: Type-check all files

- [X] Run `npm run type-check`
- [X] Resolve all TypeScript errors before marking complete

**Command**: `npm run type-check`
**Depends on**: T-011, T-012, T-013, T-014, T-015, T-031, T-041
