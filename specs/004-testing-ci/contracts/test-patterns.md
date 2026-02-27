# Test Patterns Contract: 004-testing-ci

**Purpose**: Documents the canonical patterns that ALL test files in this project must follow. Future workflow tests are expected to replicate these patterns exactly. This is the authoritative reference for AI-generated test files.

---

## File Structure Contract

```
tests/
└── unit/
    ├── lib/
    │   ├── config.test.ts          # src/lib/config.ts
    │   ├── db.test.ts              # src/lib/db.ts → getClientById()
    │   └── email.test.ts           # src/lib/email.ts → sendEmail()
    └── inngest/
        └── functions/
            └── form-notification.test.ts   # sendFormNotification workflow
```

Every test file:
- Lives under `tests/unit/` mirroring the `src/` path of the module under test
- Is named `<module>.test.ts`
- Contains no `import` from `vitest` — globals (`describe`, `it`, `expect`, `vi`) are provided by `globals: true` in `vitest.config.ts`

---

## Mock Declaration Order Contract

**RULE**: Module mocks MUST appear in this order at the top of every test file, before any other imports.

```typescript
// 1. FIRST: Mock config — prevents throw-at-import from buildConfig()
vi.mock("../../lib/config", () => ({
  config: {
    env: "development",
    emailMode: "mock",
    testEmail: null,
    resendApiKey: null,
    resendFrom: "no-reply@test.local",
    databaseUrl: "postgresql://mock",
  },
}));

// 2. THEN: Mock other lib modules (db, email, logger)
vi.mock("../../lib/db", () => ({
  getClientById: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  log: vi.fn(),
  logError: vi.fn(),
}));

// 3. THEN: Import the module under test and the mocked modules
import { sendFormNotification } from "./form-notification";
import { getClientById } from "../../lib/db";
import { sendEmail } from "../../lib/email";
```

`vi.mock()` calls are statically hoisted by Vitest above all imports regardless of where they appear in the file — but placing them first makes the hoisting intent explicit and readable.

---

## Inngest Workflow Test Contract

Every Inngest function test file MUST use `InngestTestEngine` from `@inngest/test`.

### Engine Setup Pattern

```typescript
import { InngestTestEngine, mockCtx } from "@inngest/test";

const t = new InngestTestEngine({
  function: sendFormNotification,
  transformCtx: (ctx) => ({
    ...mockCtx(ctx),       // installs vi.fn() stubs on all step.* methods
    events: [validEvent],  // the triggering event
  }),
});
```

One engine per test file. Use `t.clone({ ... })` for per-test event overrides — do NOT create a new `InngestTestEngine` per test.

### Step Isolation Pattern

```typescript
// Test a single step in isolation:
const { result } = await t.executeStep("step-name");

// Test the full function:
const { result } = await t.execute();
```

### Error Assertion Pattern

```typescript
// Exact message:
await expect(t.executeStep("validate-payload")).rejects.toThrow(
  "Missing required field: submitterEmail"
);

// Partial match:
await expect(t.executeStep("fetch-client-config")).rejects.toThrow(
  /Client not found/
);
```

### Prior Step Return Value Pattern

When the step under test consumes a prior step's return value, provide it via `steps`:

```typescript
const tWithClient = t.clone({
  steps: {
    "fetch-client-config": mockClient, // what step.run("fetch-client-config") returns
  },
});
const { result } = await tWithClient.executeStep("send-email");
```

---

## Module Unit Test Contract

For `lib/` modules tested directly (without `InngestTestEngine`):

### db.ts — `getClientById()`

Every test of `getClientById` MUST mock the `Pool.query` method (not the entire `db` module) to avoid a real database connection. Tests MUST cover:

| Scenario | Input | Expected outcome |
|----------|-------|-----------------|
| Active client exists | Known `clientId`, `active: true` row | Returns `ClientRow` |
| Client not found | Unknown `clientId`, 0 rows returned | Throws `"Client not found: <id>"` |
| Client inactive | Known `clientId`, `active: false` row | Throws `"Client inactive: <id>"` |

### email.ts — `sendEmail()`

Email mode is controlled by the mocked `config.emailMode`. Tests MUST cover all three modes:

| Mode | Config mock value | Expected behaviour |
|------|------------------|--------------------|
| mock | `emailMode: "mock"` | Returns `outcome: "logged"`, no Resend call made |
| test | `emailMode: "test"`, `testEmail: "dev@test.local"` | Sends to `testEmail`, subject prefixed with `[TEST: <original>]` |
| live | `emailMode: "live"`, `resendApiKey: "re_..."` | Calls Resend SDK with original `to` and subject |

### config.ts

Tests MUST cover:

| Scenario | Input env vars | Expected outcome |
|----------|---------------|-----------------|
| Development (default) | No `VERCEL_ENV` | `env: "development"`, `emailMode: "mock"` |
| Preview | `VERCEL_ENV=preview`, `TEST_EMAIL` set | `env: "preview"`, `emailMode: "test"` |
| Production | `VERCEL_ENV=production`, `RESEND_API_KEY` set | `env: "production"`, `emailMode: "live"` |
| Missing `DATABASE_URL` | `DATABASE_URL` absent | Throws with message identifying the missing variable |

Note: `config.ts` must be tested by importing the `buildConfig` function directly (if exported), or by resetting modules between tests (`vi.resetModules()`) so `buildConfig()` runs fresh with controlled `process.env` per test.

---

## `beforeEach` Reset Contract

Every test file MUST reset all mocks between tests to prevent state bleed:

```typescript
beforeEach(() => {
  vi.resetAllMocks();
});
```

Place this at the top-level `describe` block, not inside nested describes.

---

## CI Requirements Contract

The `.github/workflows/ci.yml` file MUST:

- Define exactly two jobs: `type-check` and `test`
- Both jobs run on `ubuntu-latest` with `node-version: '20'`
- Both jobs use `actions/setup-node@v4` with `cache: 'npm'`
- Both jobs trigger on: `push` to `main` AND `pull_request` targeting `main`
- `type-check` job runs: `npm ci` → `npm run type-check`
- `test` job runs: `npm ci` → `npm test`
- Jobs run in parallel (no `needs:` dependency between them)
