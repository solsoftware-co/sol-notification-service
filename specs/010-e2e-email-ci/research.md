# Research: Automated End-to-End Email Testing in CI

**Feature**: `010-e2e-email-ci`
**Date**: 2026-03-07

---

## Decision 1: CI Trigger Strategy

**Decision**: Trigger on `pull_request` + poll the Vercel API for deployment readiness using `patrickedqvist/wait-for-vercel-preview`.

**Rationale**: The `deployment_status` event (fired by Vercel's GitHub App) has a known, unfixed bug where `GITHUB_REF` is always empty — Vercel targets the HEAD commit rather than a branch ref, breaking branch-based conditional logic and required status check correlation. The poll-based approach (`pull_request` trigger + Vercel API polling) is the widely-recommended alternative: it gives explicit timeout control, correctly sets `GITHUB_REF`, and the action outputs a `url` field directly usable as the Preview URL.

**Alternatives considered**:
- `deployment_status` event — rejected due to `GITHUB_REF` empty-string bug and flaky timing (event may fire before deployment is fully reachable).
- Vercel's own GitHub Action (`amondnet/vercel-action`) — rejected because it re-deploys from CI rather than using the deployment Vercel already created from the push.

**Key implementation note**: `github.event.deployment_status.environment_url` is the correct field for the aliased preview URL (not `target_url`) — but this is moot given we are using the poll-based approach.

---

## Decision 2: Changed File Detection → Selective Execution

**Decision**: Use `dorny/paths-filter@v3` to detect which file groups changed, then conditionally run only the affected test suites. Use an always-run `ci-gate` job as the single required status check.

**Rationale**: `dorny/paths-filter` is the de-facto standard for path-based conditional execution in GitHub Actions. It outputs boolean flags per filter group, which downstream jobs consume via `needs.<job>.outputs.<flag>`. The critical insight is that a job with `if: false` is "skipped" — and GitHub treats a skipped required check as "pending/blocking". The fix is a `ci-gate` job with `if: always()` that succeeds when all upstream jobs are `success` or `skipped`, and is the **only** required status check in branch protection.

**Alternatives considered**:
- `github.event.pull_request.files` API — more complex, requires additional API calls.
- `paths` triggers on individual jobs — does not solve the required-check-skipped-blocks-PR problem.
- Running all suites every time — rejected per spec requirement FR-013/SC-006.

**Known limitation**: `dorny/paths-filter` has a documented issue with `merge_group` trigger events. If GitHub Merge Queue is adopted later, this will need revisiting.

---

## Decision 3: Test Email Isolation (Concurrent PR Runs)

**Decision**: Use a **timestamp window filter**: record the UTC timestamp immediately before triggering the Inngest event, then poll only for emails that arrived after that timestamp. Combined with a subject pattern match (e.g. `[TEST:`), this uniquely identifies the email for a given run without requiring multiple inboxes.

**Rationale**: Mailtrap's free tier provides 1 inbox. Multiple inboxes require a paid plan. The Mailtrap API includes a `created_at` field on each message — filtering on `created_at >= triggerTime` and matching the known subject prefix is sufficient to isolate concurrent runs, since each run triggers at a different time and the subject includes the original recipient address as a discriminator.

**Alternatives considered**:
- Clear inbox before each run (`DELETE /clean_inbox`) — breaks concurrent runs; one run wipes another's email.
- Separate Mailtrap inbox per PR — requires paid plan.
- Inject correlation ID into email subject — requires modifying workflow code; the timestamp approach requires no code changes.

---

## Decision 4: Inngest Event Trigger from CI

**Decision**: Send events via `POST https://inn.gs/e/:eventKey` using the staging environment's Event Key stored as a GitHub Actions secret. Poll for run completion via `GET https://api.inngest.com/v1/events/{eventId}/runs` using the Signing Key.

**Rationale**: Inngest's event ingestion API is the standard external trigger mechanism. Each environment has its own Event Key — using the staging key automatically targets staging. The runs endpoint returns status (`Completed`, `Failed`, `Cancelled`) and the run output, enabling the CI pipeline to confirm the workflow ran to completion before checking the inbox.

**Key shapes**:
```
POST https://inn.gs/e/:eventKey
Body: { "name": "sol/weekly.analytics.report.requested", "data": { "clientId": "test-seed-client" } }
Response: { "ids": ["<eventId>"], "status": 200 }

GET https://api.inngest.com/v1/events/:eventId/runs
Auth: Authorization: Bearer <INNGEST_SIGNING_KEY>
Response: { "data": [{ "run_id": "...", "status": "Completed" | "Failed" | "Cancelled" }] }
```

**Alternatives considered**:
- Inngest SDK `inngest.send()` from a CI Node script — functionally equivalent; the REST API is lighter for a shell-based CI step.
- Skip run polling; just wait for Mailtrap email — simpler but loses the ability to distinguish "workflow failed silently" from "email not delivered".

---

## Decision 5: Email Assertion Approach

**Decision**: Use Vitest (already in stack) for assertions. Fetch the HTML body from the Mailtrap `html_body` field and assert using simple string checks and regex where needed.

**Rationale**: The project already uses Vitest 2.x. Adding Playwright for email assertions would introduce a new test framework and heavy browser dependencies for what is ultimately string matching on an HTML payload — overkill. The Mailtrap API returns `html_body` inline in the messages response; no browser rendering is required to assert section presence, dynamic field population, and subject format.

**Alternatives considered**:
- Playwright test runner — rejected; browser capabilities are unnecessary and it would violate Constitution Principle VI (new unapproved infrastructure).
- Cheerio for HTML parsing — considered for structured assertions (CSS selectors); deferred to implementation as an optional enhancement. Simple `string.includes()` is sufficient for Phase 1 assertions.

---

## Decision 6: New Dependencies

| Package | Type | Justification |
|---|---|---|
| `@mailtrap/mailtrap-client` | devDependency | Official SDK for reading test inbox; CI/test use only |
| `dorny/paths-filter@v3` | GitHub Action | No npm package; CI workflow only |
| `patrickedqvist/wait-for-vercel-preview@v1.3.1` | GitHub Action | No npm package; CI workflow only |

**Constitution Principle VI note**: `@mailtrap/mailtrap-client` is a devDependency used exclusively in CI test scripts — it is never bundled into the production service. GitHub Actions are CI infrastructure, not production infrastructure. This is consistent with the spirit of Principle VI ("no new production infrastructure without governance amendment"). A PATCH amendment to the Technology Stack table is recommended to document the addition.
