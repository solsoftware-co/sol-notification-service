# Tasks: Automated Testing & CI Pipeline

**Input**: Design documents from `/specs/004-testing-ci/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: This feature IS the test suite — all tasks produce test files or testing infrastructure.

**Organization**: Grouped by user story for independent implementation and verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- **No story label**: Setup or polish task

---

## Phase 1: Setup

**Purpose**: Install test tooling and configure the test runner. No test files yet — just the infrastructure that makes all tests possible.

- [X] T001 Install devDependencies: run `npm install --save-dev vitest @vitest/coverage-v8 @inngest/test` from repo root
- [X] T002 Create `vitest.config.ts` at repo root with: `globals: true`, `environment: "node"`, `pool: "forks"` (see research.md Decision 1 for the exact content)
- [X] T003 [P] Update `tsconfig.json` — add `"vitest/globals"` to the `compilerOptions.types` array so `describe`/`it`/`expect`/`vi` are typed in `.test.ts` files without per-file imports
- [X] T004 [P] Update `package.json` scripts — add `"test": "vitest run"` and `"test:watch": "vitest"`
- [X] T005 Verify `inngest` resolved to `>=3.22.12` by running `npm ls inngest`; if older, update `package.json` to `"inngest": "^3.22.12"` and re-run `npm install`

**Checkpoint**: `npm test` exits with "No test files found" (not an error about the runner). `npm run type-check` still passes.

---

## Phase 2: User Story 1 — Workflow Test Suite (P1) 🎯 MVP

**Goal**: A complete test file for the `sendFormNotification` workflow that verifies all 4 steps — happy path and every failure path — runs in under 60 seconds with no live services.

**Independent Test**: `npm test` passes with 4 describe blocks, 9 test cases, 0 external connections.

### Implementation

- [X] T006 [US1] Create `tests/unit/inngest/functions/form-notification.test.ts` — add the following in order:

  **Mock declarations** (before all imports, using `vi.mock()` factory — hoisted above imports by Vitest):
  ```
  vi.mock("../../../src/lib/config", factory returning { config: { env: "development", emailMode: "mock", testEmail: null, resendApiKey: null, resendFrom: "no-reply@test.local", databaseUrl: "postgresql://mock" } })
  vi.mock("../../../src/lib/db", factory returning { getClientById: vi.fn() })
  vi.mock("../../../src/lib/email", factory returning { sendEmail: vi.fn() })
  vi.mock("../../../src/utils/logger", factory returning { log: vi.fn(), logError: vi.fn() })
  ```

  **Imports** (after mocks):
  ```
  import { InngestTestEngine, mockCtx } from "@inngest/test"
  import { sendFormNotification } from "../../../src/inngest/functions/form-notification"
  import { getClientById } from "../../../src/lib/db"
  import { sendEmail } from "../../../src/lib/email"
  ```

  **Fixture constants**:
  ```
  validEvent: { name: "form/submitted", data: { clientId: "client-acme", submitterName: "Jane Smith", submitterEmail: "jane@example.com", submitterMessage: "Hi, I'd like a quote.", formId: "contact" } }
  mockClient: { id: "client-acme", name: "Acme Corp", email: "owner@acme.com", active: true, ga4_property_id: null, settings: {}, created_at: new Date() }
  mockEmailResult: { mode: "mock", originalTo: "owner@acme.com", actualTo: "owner@acme.com", subject: "New form submission: contact", outcome: "logged" }
  ```

  **Engine** (one instance, reused across all describes):
  ```
  const t = new InngestTestEngine({ function: sendFormNotification, transformCtx: (ctx) => ({ ...mockCtx(ctx), events: [validEvent] }) })
  ```

  **`beforeEach`** at top level: `vi.resetAllMocks()`

- [X] T007 [US1] Add 4 `describe` blocks to `tests/unit/inngest/functions/form-notification.test.ts`:

  **describe "validate-payload"** (3 tests):
  1. Happy path: `await t.executeStep("validate-payload")` resolves without error when all fields are present
  2. Missing `submitterEmail`: clone `t` with `submitterEmail: ""`, assert `rejects.toThrow("Missing required field: submitterEmail")`
  3. Missing `clientId`: clone `t` with `clientId: ""`, assert `rejects.toThrow("Missing required field: clientId")`

  **describe "fetch-client-config"** (3 tests):
  1. Happy path: `vi.mocked(getClientById).mockResolvedValue(mockClient)` → `executeStep` returns the client record; `getClientById` called with `"client-acme"`
  2. Not found: `vi.mocked(getClientById).mockRejectedValue(new Error("Client not found: bad-id"))` → `rejects.toThrow("Client not found: bad-id")`
  3. Inactive: `vi.mocked(getClientById).mockRejectedValue(new Error("Client inactive: client-acme"))` → `rejects.toThrow("Client inactive: client-acme")`

  **describe "send-email"** (2 tests) — `beforeEach` sets `getClientById` → `mockClient`, `sendEmail` → `mockEmailResult`:
  1. `sendEmail` called with `expect.objectContaining({ to: "owner@acme.com", subject: "New form submission: contact" })`
  2. Step result equals `mockEmailResult`

  **describe "full execute"** (1 test) — same `beforeEach` as send-email:
  1. `t.execute()` result equals `{ clientId: "client-acme", outcome: "logged" }`

**Checkpoint**: `npm test` → 9 tests pass, 0 live connections. `npm run type-check` still passes.

---

## Phase 3: User Story 2 — CI Pipeline (P2)

**Goal**: A GitHub Actions workflow file that runs `type-check` and `test` as two parallel, independent PR checks — blocking merge on any failure.

**Independent Test**: Push a PR with an intentional test failure; both CI jobs run; `test` job fails and marks the PR as blocked; `type-check` job still completes independently.

### Implementation

- [X] T008 [US2] Create `.github/workflows/ci.yml` — two parallel jobs, both triggered on `push: branches: [main]` and `pull_request: branches: [main]`:

  **Job `type-check`** (name: `"Type Check"`):
  - `runs-on: ubuntu-latest`
  - steps: `actions/checkout@v4` → `actions/setup-node@v4` (node-version: `'20'`, cache: `'npm'`) → `npm ci` → `npm run type-check`

  **Job `test`** (name: `"Test"`):
  - `runs-on: ubuntu-latest`
  - steps: `actions/checkout@v4` → `actions/setup-node@v4` (node-version: `'20'`, cache: `'npm'`) → `npm ci` → `npm test`

  No `needs:` dependency between jobs — they run in parallel.

**Checkpoint**: Push the feature branch; both checks appear on the PR (or verify with `act pull_request --job type-check` and `act pull_request --job test` if `act` is installed locally).

---

## Phase 4: User Story 3 — Shared Infrastructure Tests (P3)

**Goal**: Individual test files for `config.ts`, `db.ts`, and `email.ts` so changes to these shared modules are caught before they reach the workflow tests.

**Independent Test**: Delete `tests/unit/inngest/functions/form-notification.test.ts` temporarily — `npm test` still runs 10 tests across the 3 lib module files and they all pass.

### Implementation

- [X] T009 [P] [US3] Create `tests/unit/lib/db.test.ts`:

  **Mocks**:
  ```
  vi.mock("@neondatabase/serverless", factory: { Pool: vi.fn().mockImplementation(() => ({ query: vi.fn() })), neonConfig: {} })
  vi.mock("../../../src/lib/config", factory: { config: { databaseUrl: "postgresql://mock" } })
  ```

  **Import**: `getClientById` from `src/lib/db`; capture the mocked `Pool` query via `vi.mocked(Pool).mock.results[0].value.query`

  **3 tests** in a single `describe("getClientById")`:
  1. Active client: `query` returns `{ rows: [{ ...mockClientRow, active: true }] }` → returns the client row
  2. Not found: `query` returns `{ rows: [] }` → throws error matching `/Client not found: client-acme/`
  3. Inactive: `query` returns `{ rows: [{ ...mockClientRow, active: false }] }` → throws error matching `/Client inactive: client-acme/`

- [X] T010 [P] [US3] Create `tests/unit/lib/email.test.ts`:

  Mock `resend` with `{ Resend: vi.fn().mockImplementation(() => ({ emails: { send: vi.fn() } })) }`. Mock `../../../src/lib/config` per test using `vi.mocked` overrides or separate `vi.mock` factories.

  **3 tests** in a single `describe("sendEmail")`:
  1. Mock mode (`emailMode: "mock"`): returns `{ outcome: "logged", mode: "mock" }`; Resend `send` is never called
  2. Test mode (`emailMode: "test"`, `testEmail: "dev@test.local"`): `send` called with `to: "dev@test.local"`; subject contains `"[TEST: owner@acme.com]"`
  3. Live mode (`emailMode: "live"`, `resendApiKey: "re_test"`): `send` called with `to: "owner@acme.com"` and the original subject unchanged

- [X] T011 [P] [US3] Create `tests/unit/lib/config.test.ts`:

  Use `vi.resetModules()` in `beforeEach` so each test re-evaluates `config.ts` with a fresh `process.env`.

  **4 tests** in a single `describe("buildConfig")`:
  1. No `VERCEL_ENV` set, `DATABASE_URL` present → `config.env === "development"`, `config.emailMode === "mock"`
  2. `VERCEL_ENV=preview`, `TEST_EMAIL` set, `DATABASE_URL` present → `config.env === "preview"`, `config.emailMode === "test"`, `config.testEmail` equals the `TEST_EMAIL` value
  3. `VERCEL_ENV=production`, `RESEND_API_KEY` set, `DATABASE_URL` present → `config.env === "production"`, `config.emailMode === "live"`
  4. `DATABASE_URL` absent → dynamic `import("../../../src/lib/config")` rejects with an error matching `/DATABASE_URL/`

**Checkpoint**: `npm test` → 16 total tests pass (9 workflow + 3 db + 3 email + 4 config — adjust if actual counts differ). No live connections.

---

## Phase 5: Polish

- [X] T012 Run `npm test` — confirm all tests pass with 0 failures; run `npm run type-check` — confirm 0 TypeScript errors; fix any issues before marking complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on T001–T005 (runner must be installed and configured)
- **US2 (Phase 3)**: Depends on T007 (CI needs `npm test` to exist and produce results)
- **US3 (Phase 4)**: Depends on T001–T005 (runner needed); T009/T010/T011 are [P] — independent of each other AND of T006/T007
- **Polish (Phase 5)**: Depends on T007, T008, T009, T010, T011

### Task Dependency Chain

```
T001 → T002 → T003 [P]
             → T004 [P]
             → T005
             ↓
             T006 → T007 → T008 [US2]
             ↓             ↓
          T009 [P]      T012
          T010 [P]
          T011 [P]
```

US3 tasks (T009–T011) depend on Setup (T001–T005) but NOT on US1 (T006–T007) — they can be written in parallel with the workflow tests by a second developer.

### Parallel Opportunities

- T003 + T004 in Setup (different files: `tsconfig.json` and `package.json`)
- T009 + T010 + T011 in US3 (different files: `db.test.ts`, `email.test.ts`, `config.test.ts`)
- T008 (US2) and T009–T011 (US3) can be written in parallel (CI yml vs lib test files)

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. T001–T005 — Setup
2. T006–T007 — Create `form-notification.test.ts` with all 9 test cases
3. **STOP and VALIDATE**: `npm test` → 9 tests pass, no live services required, `npm run type-check` passes

### Full Delivery

4. T008 — CI pipeline (`.github/workflows/ci.yml`)
5. T009–T011 — Lib module tests (all three in parallel)
6. T012 — Final validation

---

## Notes

- Total tasks: **12**
- Tasks per story: US1 = 2 (T006, T007) | US2 = 1 (T008) | US3 = 3 (T009, T010, T011) | Setup = 5 | Polish = 1
- Parallel opportunities: T003+T004 in setup; T009+T010+T011 in US3; T008+T009–T011 across US2 and US3
- The `vi.mock()` factory pattern for `config` MUST appear before any other mock — Vitest hoists it but the intent must be explicit
- After T008 is merged to `main`, a repository admin must manually add `Type Check` and `Test` as required status checks in GitHub Settings → Branches → Branch protection rules
- `@inngest/test 0.1.7` requires `inngest >= 3.22.12` — T005 explicitly verifies this before any test code is written
