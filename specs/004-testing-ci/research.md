# Research: Automated Testing & CI Pipeline

**Feature**: 004-testing-ci
**Date**: 2026-02-27
**Status**: Complete — all unknowns resolved

---

## Decision 1: Test Runner

**Decision**: Vitest

**Rationale**:
- esbuild-based TypeScript transpilation is built in — zero additional transformer packages (`ts-jest`, `@swc/jest`, etc.)
- `vi.mock()` calls are statically hoisted before any imports execute, which is critical for this project because `src/lib/config.ts` throws at module load time if `DATABASE_URL` is absent — hoisting allows us to mock `config` before the throw
- `vitest run` is a single command with no pre-compilation step; test files are `.ts` and run directly
- `globals: true` gives Jest-ergonomic `describe`/`it`/`expect`/`vi` without importing from vitest in every file
- 3-10x faster cold starts than `ts-jest` (esbuild vs TypeScript compiler)
- `pool: "forks"` (default since Vitest 2) runs tests in child processes — avoids worker_threads CJS/ESM edge cases
- The project's `"module": "commonjs"` tsconfig setting is compatible: Vitest bypasses it via esbuild, and all dependencies (`inngest`, `resend`, `@neondatabase/serverless`) ship CJS-compatible builds

**Alternatives considered**:
- **Jest + ts-jest**: More mature CJS story, but requires `ts-jest` + `@types/jest` devDependencies, slower compile (full TSC per file), and identical mocking API to Vitest — no meaningful advantage for this stack
- **Jest + @swc/jest**: Faster than ts-jest, but still requires `@swc/core` + `@swc/jest`; same result as Vitest with more package overhead
- **Node 22 native type stripping + Jest 30**: Incompatible — project requires Node >=20, and `--experimental-strip-types` is only available from Node 22.6+

**Packages to install**:
```bash
npm install --save-dev vitest @vitest/coverage-v8
```

**Minimum config** (`vitest.config.ts` at repo root):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
  },
});
```

**tsconfig.json addition** (for typed globals in test files):
```json
"types": ["vitest/globals"]
```

**npm scripts to add**:
```json
"test":          "vitest run",
"test:watch":    "vitest"
```

---

## Decision 2: Inngest Workflow Testing

**Decision**: `@inngest/test` with `InngestTestEngine`

**Rationale**:
- Official Inngest SDK companion package — maintained by the Inngest team
- `InngestTestEngine.executeStep("step-name")` drives the function's internal step machinery locally, stopping at the target step and returning its result — no running Inngest Dev Server required
- `InngestTestEngine.execute()` runs the entire function to completion
- `mockCtx` helper auto-installs Vitest/Jest-compatible spy stubs on all `step.*` methods
- `.clone({ transformCtx })` pattern allows overriding the event payload per test case
- Step-level mock return values via `steps: { "step-name": returnValue }` option removes the need to mock both the module AND the step output

**Critical version constraint**: `@inngest/test ^0.1.7` requires `inngest >= 3.22.12`.
Current `package.json` specifies `"inngest": "^3.0.0"` — this resolves to the latest 3.x, which should satisfy `>=3.22.12`, but this must be verified after `npm install`. If not, pin to `^3.22.12`.

**Packages to install**:
```bash
npm install --save-dev @inngest/test
```

**Import pattern**:
```typescript
import { InngestTestEngine, mockCtx } from "@inngest/test";
```

**Alternatives considered**:
- **Extract step bodies to pure functions and test directly**: Viable but changes production code structure (step bodies become named functions, not inline lambdas). Rejected — would require touching `form-notification.ts` purely to make it testable, which adds complexity without benefit given `@inngest/test` exists
- **Mock `step.run` directly with `vi.fn()`**: Possible but fragile — requires understanding Inngest's internal step tracking mechanism. Rejected in favor of the official harness
- **Integration tests against a real Inngest Dev Server**: Out of scope per spec; also slow and requires running infrastructure

---

## Decision 3: Config Module Isolation in Tests

**Decision**: `vi.mock("../../lib/config")` with a factory returning a static config object

**Rationale**:
`src/lib/config.ts` calls `buildConfig()` at module evaluation time and throws if `DATABASE_URL` is absent. Any test file that imports `src/lib/db.ts` or `src/lib/email.ts` will trigger this throw transitively, before any `beforeEach` or test setup runs.

The only solution that works for both runners: `vi.mock()` is hoisted above all import statements by Vitest's transform pipeline. Mocking `config` before `db.ts` or `email.ts` are imported prevents the throw.

**Pattern** (must appear before other imports in every test file that touches db/email):
```typescript
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
```

**Alternative**: Set `process.env.DATABASE_URL = "mock"` in a `setupFiles` entry. Simpler for global setup, but still requires `config.ts` to accept the value — chosen approach (per-test mock) is more explicit and flexible.

---

## Decision 4: Test File Location

**Decision**: `tests/` directory at the repository root, mirroring `src/` structure

**Structure**:
```text
tests/
├── unit/
│   ├── lib/
│   │   ├── config.test.ts
│   │   ├── db.test.ts
│   │   └── email.test.ts
│   └── inngest/
│       └── functions/
│           └── form-notification.test.ts
```

**Rationale**:
- Keeps test files out of `src/` — avoids them appearing in `dist/` if TypeScript build is run without explicit `exclude`
- Mirrors the source directory tree, making it easy to find the test for any given file
- Vitest discovers test files by glob pattern (`**/*.test.ts`) — no config change required for this structure

**Alternative**: Co-locate test files in `src/` (e.g., `src/lib/config.test.ts`). Common in frontend projects. Rejected because the `tsc` build would need to explicitly exclude test files from compilation — adds tsconfig complexity.

---

## Decision 5: CI Provider and Job Structure

**Decision**: GitHub Actions with two parallel jobs (`type-check` and `test`)

**Rationale**:
- Two separate jobs show as two independent named checks on the PR — a developer sees both pass/fail at a glance
- Type-check failure does not cancel the test run; the full picture is visible in one CI run
- `actions/setup-node@v4` with `cache: 'npm'` caches `~/.npm` using `package-lock.json` hash as the key — zero extra config
- Each job is `ubuntu-latest` with `node-version: '20'`

**File**: `.github/workflows/ci.yml`

**Trigger**: `push` to `main` + `pull_request` targeting `main`

**Merge blocking**: GitHub's branch protection "Required status checks" feature blocks merging when either job fails. Configuring this is an admin step (repository Settings → Branches → Branch protection rules) outside the scope of this implementation.

**Alternative**: One job with two sequential steps (`type-check` then `test`). Rejected — GitHub would show one combined check, hiding which step failed until the log is opened.

---

## Summary Table

| Decision | Choice | Key Constraint |
|----------|--------|---------------|
| Test runner | Vitest 4.x | `vitest run` for CI, no pre-compilation |
| Inngest step testing | `@inngest/test` 0.1.7 | Requires `inngest >= 3.22.12` |
| Config isolation | `vi.mock()` factory (hoisted) | Must appear before db/email imports |
| Test file location | `tests/unit/` mirroring `src/` | Excluded from tsc build output |
| CI | GitHub Actions, 2 parallel jobs | Branch protection required (admin step) |
