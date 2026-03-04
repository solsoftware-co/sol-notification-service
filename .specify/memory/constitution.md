<!--
SYNC IMPACT REPORT
==================
Version change: N/A → 1.0.0 (initial ratification — no prior constitution existed)
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (I–VI)
  - Technology Stack
  - Development Standards
  - Governance
Removed sections: N/A (initial)
Templates requiring updates:
  ✅ plan-template.md — Constitution Check gates align with principles I–VI above
  ✅ spec-template.md — Requirements section maps to FR-1 through FR-9 from the PRD
  ✅ tasks-template.md — Observability, multi-env safety, and multi-tenant task types are reflected
  ✅ agent-file-template.md — Stack references aligned (Inngest, TypeScript, Neon, Resend)
Deferred TODOs:
  - TODO(CLAUDE_MD): .claude/CLAUDE.md agent instructions file not yet created; referenced
    in Principle V. Must be created during Phase 4 (AI Integration) per PRD timeline.
  - TODO(REVIEWER): Constitution sign-off reviewer is TBD per PRD approval table.
-->

# Notification Service Constitution

## Core Principles

### I. Event-Driven Workflow First

Every notification capability MUST be implemented as an Inngest function triggered by a
named event or cron schedule. Direct API calls or synchronous notification delivery MUST NOT
be used. Each function MUST use Inngest `step.*` primitives for every distinct operation to
ensure automatic retries, observability, and replay capability.

**Non-negotiable rules:**
- All notification workflows MUST be defined as `inngest.createFunction(...)` calls
- Every discrete operation (fetch, transform, send) MUST be wrapped in `step.run(...)`
- Event names MUST follow the `domain/action.pastTense` convention (e.g., `form/submitted`,
  `analytics/report.requested`)
- Failed steps MUST retry automatically with a minimum of 3 attempts configured
- Scheduled workflows MUST use Inngest cron syntax (e.g., `{ cron: "0 9 * * MON" }`)

**Rationale:** Inngest's step-based execution provides the reliability, per-step
observability, and zero-infrastructure local development that replaces the prior
GCP Cloud Functions + Pub/Sub architecture, which had poor DX and scattered logs.

### II. Multi-Environment Safety

All code MUST behave correctly across development, preview, and production environments
without source-code modification. Environment-specific behavior MUST be controlled exclusively
via the `EMAIL_MODE` and `VERCEL_ENV` environment variables — never via hardcoded conditionals
on client identifiers, URLs, or other non-environment signals.

**Non-negotiable rules:**
- Development MUST use `EMAIL_MODE=mock` (console.log only; zero real emails sent)
- Preview MUST use `EMAIL_MODE=test` (redirect all emails to `TEST_EMAIL` address, with
  an `[TEST: <original_recipient>]` subject prefix)
- Production MUST use `EMAIL_MODE=live` (deliver to real client addresses)
- Non-production scheduled workflows MUST apply a safety rate limit (e.g., `limit: 1` per
  hour) and MUST filter to test clients only (clients whose email contains `test`)
- Each environment MUST use a separate `DATABASE_URL`; credentials MUST NOT be shared
  across environments
- Every environment MUST be distinguishable in logs via `config.env`

**Rationale:** Prevents accidental real email sends during development or staging. Preview
deployments must be testable safely without impacting production data or real clients.
This was an explicit architectural decision in the transition away from GCP.

### III. Multi-Tenant by Design

Every workflow, database query, and configuration lookup MUST be scoped to a specific client
identified by `clientId`. Client configuration MUST be stored in the `clients` database table
and fetched dynamically at runtime. Client-specific data (email addresses, GA4 property IDs,
notification settings) MUST NOT be hardcoded in source files or environment variables.

**Non-negotiable rules:**
- All Inngest functions MUST receive and validate `clientId` from the triggering event payload
- Client configuration MUST be retrieved via a `step.run(...)` database query using
  `src/lib/db.ts` — not from environment variables or in-code constants
- Batch (scheduled) workflows MUST fan out to per-client events so each client runs
  independently in parallel
- One client's failure MUST NOT block or affect other clients' workflows; fan-out isolation
  is required

**Rationale:** The service is designed to scale from 1 to 100 clients. Hardcoding client
data requires code changes for every onboarding or offboarding operation and prevents safe
multi-tenant isolation in a shared codebase.

### IV. Observability by Default

Every workflow MUST produce sufficient logs and step-level data to allow a developer to
diagnose any failure within 5 minutes using the Inngest dashboard. Log entries MUST be
correlated by environment name, client ID, and step outcome.

**Non-negotiable rules:**
- Every `step.run(...)` call MUST include a human-readable step name (e.g.,
  `"fetch-client-config"`, `"send-email"`)
- The current `config.env` value MUST be logged at function start
- Email send outcomes (success ID, mock/test/live mode, original recipient) MUST be logged
- Errors MUST include `clientId` and event name for cross-run correlation
- Failed runs MUST be replayable from the Inngest dashboard without code changes
- All email sending MUST route through `src/lib/email.ts` to ensure consistent logging and
  mode enforcement

**Rationale:** Scattered, difficult-to-correlate logs were the primary operational pain
point with the prior GCP implementation. Observability is a first-class requirement enforced
at the code-pattern level, not left to individual developer discretion.

### V. AI-Agent Friendly Codebase

All workflows MUST follow the patterns established in `src/inngest/functions/template.ts`
and be accompanied by a corresponding markdown spec in `specs/`. New workflows generated
by AI agents MUST be verifiable as ≥80% correct before human review without requiring
additional runtime context.

**Non-negotiable rules:**
- Every workflow MUST have a corresponding spec file in `specs/` before implementation begins
- Function structure MUST follow the canonical template: event trigger → client config fetch
  → step chain → email send → log result
- Event payload types MUST be defined in `src/types/index.ts` before the function is written
- Function IDs MUST use kebab-case and describe the workflow action
  (e.g., `send-form-notification`, `generate-analytics-report`)
- `.claude/CLAUDE.md` MUST be kept current with any pattern changes that affect AI-generated
  workflow correctness; it MUST reference this constitution

**Rationale:** AI-assisted workflow creation (UC-5) is a primary goal. Consistent, documented
patterns allow Claude Code and other agents to generate new workflows that are immediately
usable. Inconsistent patterns would undermine the AI-extension goal.

### VI. Minimal Infrastructure & Developer Experience

The service MUST run entirely via `npm run dev` with no Docker, container runtime, or
cloud-provider emulators required for local development. All production dependencies MUST
have free tiers sufficient for the PoC target scale. New infrastructure components MUST NOT
be introduced without explicit governance amendment.

**Non-negotiable rules:**
- Local development MUST work with `npm run dev` alone (Inngest Dev Server + app server)
- The approved stack for this PoC is fixed (see Technology Stack section); additions require
  a MINOR or MAJOR version amendment to this constitution
- Time from `git clone` to first successful local test MUST remain under 15 minutes
- All PoC usage MUST stay within free tiers:
  Inngest ≤ 50k runs/month, Resend ≤ 3k emails/month, Neon ≤ 512 MB, Vercel Hobby plan
- `DATABASE_URL` for local development MUST support both local Postgres and Neon dev branch
  without code changes (connection string swap only)

**Rationale:** The single largest motivation for replacing GCP Cloud Functions was the
poor local development experience. Keeping setup simple preserves rapid iteration speed
and low onboarding cost for current and future developers (and AI agents).

## Technology Stack

The following technologies are approved for this PoC. Additions or replacements require a
constitution amendment (MINOR bump minimum; MAJOR if a core service is replaced).

| Layer | Technology | Approved Version |
|-------|-----------|-----------------|
| Event Platform | Inngest | ^3.x |
| Runtime | Node.js | 20+ |
| Language | TypeScript | ^5.x |
| Database client | @neondatabase/serverless | ^0.9.x |
| Email Provider | Resend | ^3.x |
| Hosting | Vercel | Hobby plan |
| AI Provider | Anthropic Claude (anthropic SDK) | ^0.x |
| Analytics | Google Analytics 4 (@google-analytics/data) | ^4.x |
| Local dev tooling | tsx | ^4.x |
| Email rendering | React + React Email | react ^18, @react-email/components ^0.0.x, @react-email/render ^1.x |

**Explicitly out-of-scope for PoC:** SMS (Twilio), Slack, push notifications (Firebase),
client self-service UI, advanced analytics, load testing infrastructure.

## Development Standards

### Project Structure Compliance

Source code MUST conform to the directory layout specified in the PRD and enforced here:

```
src/
├── index.ts                  # Main entry point / Inngest serve handler
├── inngest/
│   ├── client.ts             # Environment-aware Inngest client
│   └── functions/
│       ├── index.ts          # Export all functions
│       ├── template.ts       # Canonical template (AI copies this)
│       ├── form-notification.ts
│       └── weekly-analytics.ts
├── lib/
│   ├── config.ts             # All environment config (single source of truth)
│   ├── db.ts                 # Database client & queries
│   ├── email.ts              # Email abstraction (mock/test/live routing)
│   ├── analytics.ts          # GA4 integration
│   └── templates.ts          # Email HTML templates
├── types/
│   └── index.ts              # All shared TypeScript types & event schemas
└── utils/
    └── logger.ts             # Logging utilities
specs/                        # One .md file per workflow (required)
scripts/                      # setup-db.ts, seed-data.ts, test-event.ts
.claude/CLAUDE.md             # AI agent instructions (references this constitution)
```

### Code Quality Gates

A workflow is NOT considered complete until all of the following pass:

- [ ] Corresponding spec exists in `specs/` describing the workflow
- [ ] All discrete steps use `step.run(...)` with descriptive, human-readable names
- [ ] Email sending routes through `src/lib/email.ts` (NEVER directly to Resend SDK)
- [ ] Client configuration is fetched from the database (NEVER hardcoded)
- [ ] Non-production scheduled workflows include a safety rate limit and test-client filter
- [ ] Logs include `config.env` at function start and `clientId` in all error paths
- [ ] TypeScript event payload type is defined in `src/types/index.ts`

### Security Requirements

- API keys and credentials MUST be stored in environment variables exclusively
- `.env.local` MUST be listed in `.gitignore` and MUST NOT be committed
- No client data (emails, GA4 property IDs) MUST appear in source files or committed config
- Client data MUST be isolated per tenant; cross-tenant data access is prohibited
- Email addresses MUST be validated (non-empty, contains `@`) before any send call
- `DATABASE_URL` and `RESEND_API_KEY` MUST use separate values per environment

## Governance

This constitution supersedes all other architectural guidance for the Notification Service.
In conflicts between this document and any other guide (README, inline comments, prior
practice), this constitution takes precedence.

**Amendment procedure:**
1. Identify the affected principle(s) and determine the version bump type (PATCH/MINOR/MAJOR)
2. Update this file with new version, today's date in `Last Amended`, and revised content
3. Run the Sync Impact Report checklist: update plan-template, spec-template, tasks-template,
   and agent-file-template as needed
4. Update `.claude/CLAUDE.md` if any workflow pattern changes
5. Document a migration path in the Sync Impact Report for workflows already implemented

**Versioning policy:**
- **MAJOR**: Principle removal, redefinition, or replacement of a core technology
- **MINOR**: New principle added, new section, or materially expanded guidance
- **PATCH**: Clarifications, wording fixes, non-semantic refinements

**Compliance review:**
All PRs adding or modifying workflows MUST verify compliance with the Constitution Check
gates in `plan-template.md` before merge. Violations of Principle VI (unapproved
infrastructure) MUST be justified in the plan's Complexity Tracking table with explicit
rationale for why no simpler approach exists.

**Version**: 1.0.0 | **Ratified**: 2026-02-13 | **Last Amended**: 2026-02-23
