# Tasks: Structured Logging with Pino + Better Stack

**Input**: Design documents from `/specs/008-structured-logging/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: No test tasks generated — the spec does not request TDD. Existing test suite compatibility is validated via `npm run type-check` and `npm test` in US2.

**Organization**: Tasks are grouped by user story. US1 is the full implementation; US2 and US3 are validation and verification phases that confirm correctness of the US1 implementation from different angles.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install dependencies and amend the constitution before any source code changes.

- [x] T001 Install runtime dependencies — run `npm install pino @logtail/pino` (adds both to `dependencies` in `package.json`)
- [x] T002 [P] Install dev dependency — run `npm install --save-dev pino-pretty` (adds to `devDependencies` in `package.json`)
- [x] T003 [P] Amend `.specify/memory/constitution.md` — bump version `1.0.0 → 1.1.0`, add four rows to the Technology Stack table (`pino ^9.x`, `pino-pretty` devDep, `@logtail/pino ^3.x`, Better Stack free plan), add `LOGTAIL_SOURCE_TOKEN` to the Development Standards environment variables section, update `Last Amended` date

**Checkpoint**: Dependencies installed, constitution reflects new approved stack.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the type system and config singleton before any logger code touches them. Both tasks must complete before Phase 3 begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add `logtailToken: string | null` to the `AppConfig` interface in `src/types/index.ts` — nullable field, placed alongside other optional config fields
- [x] T005 Add `logtailToken: process.env.LOGTAIL_SOURCE_TOKEN ?? null` to the `buildConfig()` return object in `src/lib/config.ts` — must NOT throw when the variable is absent; absence triggers the stdout fallback

**Checkpoint**: `npm run type-check` passes. `config.logtailToken` is accessible as `string | null` throughout the codebase.

---

## Phase 3: User Story 1 — Production Log Searchability (Priority: P1) 🎯 MVP

**Goal**: Emit structured log entries enriched with `level`, `time`, `env`, `service`, and `clientId` — transported to Better Stack in non-dev environments for real-time search and filtering.

**Independent Test**: Run `npm run dev`, trigger a workflow via Inngest Dev UI, confirm colorized structured output appears in terminal. Then deploy to preview with `LOGTAIL_SOURCE_TOKEN` set and confirm entries appear in Better Stack within 10 seconds.

- [x] T006 [US1] Initialize module-private `pinoLogger` in `src/utils/logger.ts` — configure `base: { service: 'sol-notification-service' }`, `timestamp: pino.stdTimeFunctions.isoTime`, `formatters.bindings` returning `{ ...bindings, env: config.env }`, `formatters.level` returning `{ level: label }`, and three-way `transport.targets`: dev (`config.env === 'development'`) → `{ target: 'pino-pretty', level: 'debug', options: { colorize: true } }`; non-dev + `config.logtailToken` → `{ target: '@logtail/pino', level: 'info', options: { sourceToken: config.logtailToken } }`; non-dev + no token → `{ target: 'pino/file', level: 'info', options: { destination: 1 } }` (stdout JSON safety fallback — never an empty array)
- [x] T007 [US1] Add public exports to `src/utils/logger.ts` — `log(message: string, context?: LogContext): void` calling `pinoLogger.info({ ...context }, message)`; `logError(message: string, error: unknown, context?: LogContext): void` calling `pinoLogger.error({ ...(context ?? {}), err: error }, message)`; `flush(): void` calling `pinoLogger.flush()`. Preserve the existing `LogContext` interface (`clientId?: string; [key: string]: unknown`). The `pinoLogger` instance must NOT be exported.
- [x] T008 [US1] Add SIGTERM handler to `src/index.ts` — import `flush` from `'./utils/logger'` and register `process.on('SIGTERM', () => flush())` to drain the async transport before Vercel hard-kills the process

**Checkpoint**: US1 complete. `npm run dev` produces colorized pino-pretty output. Deploying to preview with `LOGTAIL_SOURCE_TOKEN` set produces entries in Better Stack with all required fields.

---

## Phase 4: User Story 2 — No Regressions at Existing Call Sites (Priority: P2)

**Goal**: Confirm every existing `log()` and `logError()` call site compiles and all existing tests pass without any call-site code changes.

**Independent Test**: `npm run type-check` exits 0. `npm test` exits 0 with all tests green.

- [x] T009 [US2] Update all logger mock factories in `tests/unit/` — search for every `vi.mock` call that mocks `logger` (pattern: `vi.mock('../../utils/logger'` or similar path), and add `flush: vi.fn()` to each mock factory's return object. Run `grep -r "vi.mock" tests/unit/ | grep logger` to find all occurrences.
- [x] T010 [US2] Run `npm run type-check` and `npm test` — confirm zero TypeScript errors and all existing tests pass. No call-site changes should be needed; if any appear, investigate before changing call sites.

**Checkpoint**: US2 complete. Full test suite green. TypeScript clean.

---

## Phase 5: User Story 3 — Multi-Environment Visibility (Priority: P3)

**Goal**: Confirm that `preview` and `production` logs both flow to Better Stack and are filterable by `env` field, and that local dev logs remain stdout-only.

**Independent Test**: Trigger runs in two different environments; verify both appear in Better Stack filterable by `env = 'preview'` and `env = 'production'`.

- [x] T011 [US3] Add `LOGTAIL_SOURCE_TOKEN` entry to `.env.local` (or `.env.local.example` if it exists) — add as a commented-out line: `# LOGTAIL_SOURCE_TOKEN=   # Leave absent in local dev — logger falls back to stdout JSON`
- [ ] T012 [US3] Set `LOGTAIL_SOURCE_TOKEN` in Vercel dashboard for **Production** and **Preview** environments (Settings → Environment Variables) — do NOT set for the Development environment
- [ ] T013 [US3] Validate end-to-end per `specs/008-structured-logging/quickstart.md` — deploy to preview, trigger a workflow, open Better Stack, confirm entries appear with all required fields, filter by `env = 'preview'` and `env = 'production'` to verify per-environment isolation

**Checkpoint**: US3 complete. Both preview and production logs visible in Better Stack, filterable by `env`. Local dev logs remain stdout-only.

---

## Phase 6: Polish

**Purpose**: Final documentation alignment.

- [x] T014 [P] Update `CLAUDE.md` (if `src/utils/logger` is referenced) — note that `logger.ts` now uses Pino; `flush()` is exported for SIGTERM; never import pino directly in other files
- [x] T015 [P] Verify `specs/008-structured-logging/data-model.md` environment routing table matches the actual implemented transport conditions after T006 is complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 can all start immediately; T002 and T003 are parallel to T001
- **Foundational (Phase 2)**: T004 has no dependencies; T005 depends on T004 (needs `AppConfig` type updated first)
- **US1 (Phase 3)**: T006 depends on T005 (`config.logtailToken` must exist); T007 depends on T006 (wraps the private instance); T008 depends on T007 (`flush` must be exported)
- **US2 (Phase 4)**: T009 depends on T007 (`flush` export must exist to add to mocks); T010 depends on T009
- **US3 (Phase 5)**: T011 is independent; T012 depends on T008 (full implementation must be deployed); T013 depends on T012
- **Polish (Phase 6)**: T014 and T015 are independent, run after all user stories complete

### Within-Story Task Order

```
T001 ──┐
T002   ├── Phase 1 complete
T003 ──┘
         │
T004 ────┤
T005 ────┘── Phase 2 complete
              │
T006 ─────────┤
T007 ─────────┤── US1 complete
T008 ─────────┘
               │
T009 ──────────┤── US2 complete
T010 ──────────┘
               │
T011 ──────────┤
T012 ──────────┤── US3 complete
T013 ──────────┘
```

### Parallel Opportunities

Within Phase 1: T002 and T003 are parallel with T001.
Within Phase 3: T006–T008 are sequential (same file, each builds on previous).
Within Phase 4: T009 and T010 are sequential (test must be updated before running).
Within Phase 5: T011 is parallel with T012.
Within Phase 6: T014 and T015 are parallel.

---

## Parallel Execution Examples

### Phase 1 (Setup)
```bash
# Start simultaneously:
Task T001: npm install pino @logtail/pino
Task T002: npm install --save-dev pino-pretty
Task T003: Update constitution.md
```

### Phase 5 (US3 Verification)
```bash
# T011 can run while T012 is being configured:
Task T011: Add LOGTAIL_SOURCE_TOKEN to .env.local.example
Task T012: Set LOGTAIL_SOURCE_TOKEN in Vercel dashboard
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: User Story 1 (T006–T008)
4. **STOP and VALIDATE**: Run dev server, confirm pino-pretty output; deploy preview, confirm Better Stack entries
5. Ship — US1 alone delivers full production observability value

### Incremental Delivery

1. Setup + Foundational → config ready
2. US1 (T006–T008) → logs flowing to Better Stack → **MVP deployed**
3. US2 (T009–T010) → test suite confirmed green → **safe to merge**
4. US3 (T011–T013) → multi-env filtering validated → **fully verified**
5. Polish (T014–T015) → documentation complete

---

## Notes

- `pinoLogger` must be kept module-private in `src/utils/logger.ts` — only `log`, `logError`, and `flush` are exported
- Never use `process.env.LOGTAIL_SOURCE_TOKEN` directly in `logger.ts` — always read from `config.logtailToken`
- The `transport.targets` array must never be empty — the `pino/file` fallback ensures logs always go somewhere
- `pino-pretty` is a devDependency; it must only appear in the transport targets when `config.env === 'development'`
- All `[P]` tasks can be dispatched to parallel agents if available
