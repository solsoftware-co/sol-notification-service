# Implementation Plan: Automated End-to-End Email Testing in CI

**Branch**: `010-e2e-email-ci` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/010-e2e-email-ci/spec.md`

## Summary

Add an automated end-to-end email testing pipeline that triggers on every PR, detects which email flows were affected by the changed files, triggers only the relevant Inngest workflows against the Vercel Preview deployment, waits for emails to arrive in a Mailtrap test inbox, and asserts on the delivered email content — posting a pass/fail result back to the PR. PRs touching no email-related files skip the test suite entirely and are never blocked.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**:
- New (devDeps): `@mailtrap/mailtrap-client` (test inbox SDK)
- New (CI only, no npm): `dorny/paths-filter@v3`, `patrickedqvist/wait-for-vercel-preview@v1.3.1`
- Existing: `inngest ^3.x`, `vitest ^2.x`, `tsx ^4.x`

**Storage**: None — no database schema changes
**Testing**: Vitest 2.x (existing) for e2e email assertions
**Target Platform**: GitHub Actions CI + Vercel Preview environments
**Project Type**: CI/CD pipeline + test suite (pure devDependency addition to existing service)
**Performance Goals**: Full pipeline (deploy wait excluded) completes within 90 seconds per flow; PR receives result within 3 minutes of Vercel deployment completing
**Constraints**: Free tiers only — Mailtrap free (1 inbox, 1,000 emails/month); GitHub Actions free tier
**Scale/Scope**: Single-digit PRs/day; 1–2 email flows per run

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Event-Driven Workflow First | ✅ Pass | No new Inngest functions. Existing workflows are triggered via the REST API from CI — not bypassing step-based execution |
| II. Multi-Environment Safety | ✅ Pass | Pipeline exclusively targets Preview environments. Production is never contacted. `EMAIL_MODE=test` already active on Preview |
| III. Multi-Tenant by Design | ✅ Pass | CI triggers workflows using the `test-seed-client` clientId — a designated test tenant. Client config is still fetched from staging DB, not hardcoded |
| IV. Observability by Default | ✅ Pass | No changes to workflow logging. CI pipeline polls Inngest run status, giving visibility into run outcome before checking inbox |
| V. AI-Agent Friendly | ✅ Pass | Spec exists before implementation. `flow-map.ts` gives AI agents a single, documented place to add new flows |
| VI. Minimal Infrastructure | ⚠️ Justified | `@mailtrap/mailtrap-client` is a new devDependency. It is CI/test-only — never bundled into the production service. GitHub Actions (CI infrastructure) are not production infrastructure. PATCH constitution amendment recommended to document addition |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New devDep: `@mailtrap/mailtrap-client` | Required to read and assert on emails delivered to the Mailtrap test inbox via API | No alternative: Mailtrap has no other read interface; the SDK wraps the REST API. It is never bundled into production |

## Project Structure

### Documentation (this feature)

```text
specs/010-e2e-email-ci/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── e2e-email.yml            # CI workflow: detect changes → wait for deploy → trigger → assert → gate

tests/
└── e2e/
    └── email/
        ├── flow-map.ts          # Central config: flow → file patterns + event + test file
        ├── helpers/
        │   ├── mailtrap.ts      # waitForEmail() — polls inbox with timestamp window filter
        │   └── inngest.ts       # triggerFlow() — sends event + polls run completion
        ├── weekly-analytics.test.ts     # Vitest assertions for analytics email
        └── form-notification.test.ts    # Vitest assertions for form notification email
```

**Structure Decision**: All new files are CI/test infrastructure only. Zero changes to `src/`. The `flow-map.ts` is the single maintenance point when new email flows are added.

## Implementation Phases

### Phase 1: Mailtrap helper + first flow test (weekly analytics)

**Goal**: Prove the full loop — trigger Inngest staging → email arrives in Mailtrap → Vitest assertions pass.

**Deliverables**:
1. `@mailtrap/mailtrap-client` added to devDependencies
2. `tests/e2e/email/helpers/mailtrap.ts` — `waitForEmail(subjectPattern, triggeredAt, timeoutMs)` using timestamp window + subject regex filter
3. `tests/e2e/email/helpers/inngest.ts` — `triggerFlow(eventName, eventData, previewUrl)` sends event + polls `GET /v1/events/:id/runs` until terminal state
4. `tests/e2e/email/flow-map.ts` — initial entry for `weekly-analytics` flow
5. `tests/e2e/email/weekly-analytics.test.ts` — assertions: subject prefix, analytics summary section present, client name populated, no raw template syntax
6. `npm run test:e2e` script in `package.json`

### Phase 2: GitHub Actions workflow — selective execution

**Goal**: Automate the pipeline end-to-end on every PR with change-based routing.

**Deliverables**:
1. `.github/workflows/e2e-email.yml` with:
   - `pull_request` trigger
   - `detect-changes` job using `dorny/paths-filter@v3` with flow patterns + shared patterns
   - `wait-for-deployment` job using `patrickedqvist/wait-for-vercel-preview@v1.3.1`
   - `e2e-weekly-analytics` job (conditional on `detect-changes` output)
   - `ci-gate` job with `if: always()` — the only required status check
2. GitHub Actions secrets documented in quickstart.md (already written)

### Phase 3: Second flow + shared-files-trigger-all logic

**Goal**: Prove selective execution and shared-file fallback with a second flow.

**Deliverables**:
1. `tests/e2e/email/form-notification.test.ts` — assertions for form notification email
2. `flow-map.ts` updated with `form-notification` entry
3. `.github/workflows/e2e-email.yml` updated:
   - `e2e-form-notification` job (conditional)
   - Shared patterns group — when matched, both flow jobs run
   - `ci-gate` updated to include both flow jobs in `needs`

### Phase 4: Branch protection + documentation

**Goal**: Enforce the gate and finalise docs.

**Deliverables**:
1. Branch protection rule: `ci-gate` set as required status check on `main`
2. CLAUDE.md updated: document `flow-map.ts` as the registration point for new e2e flows
3. Constitution PATCH amendment: add `@mailtrap/mailtrap-client` to Technology Stack devDeps table

## Key Design Decisions

### Timestamp window isolation (no inbox-per-run)
Mailtrap free tier = 1 inbox. Concurrent PR runs are isolated by recording `Date.now()` before triggering and only accepting emails with `created_at >= triggeredAt`. Combined with a subject pattern match (`/\[TEST:/`), this uniquely identifies the email for each run without requiring multiple inboxes or modifying workflow code.

### Always-run ci-gate pattern
`dorny/paths-filter` skips jobs when no matching files changed — but GitHub treats skipped required checks as "pending", blocking the PR. The fix: `ci-gate` has `if: always()` and is the only required check. It passes when all upstream jobs are `success` OR `skipped`, and fails only when any job actually failed.

### Poll-based deployment trigger (not deployment_status)
Vercel's `deployment_status` GitHub event has a known bug: `GITHUB_REF` is always empty, breaking branch-correlated status checks. We use `pull_request` + `patrickedqvist/wait-for-vercel-preview` which polls Vercel's API until the deployment is `READY` and outputs the URL.

### Vitest (not Playwright) for assertions
Email content assertions are string/regex checks on an HTML payload from the Mailtrap API. No browser rendering needed. Vitest is already in the stack; adding Playwright would violate Constitution Principle VI without adding value.
