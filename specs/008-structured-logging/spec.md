# Feature Specification: Structured Logging with Centralized Log Management

**Feature Branch**: `008-structured-logging`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "I want to upgrade how logging is done on my application. I want a production grade logging library that is fast, plus a transport layer to a high-quality, affordable log management system with a generous free tier."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Find a log event in production (Priority: P1)

A developer is investigating a bug reported by a client. They need to find all log events related to that client's workflow run — filtered by client ID, time range, and severity — without SSH-ing into a server or tailing raw stdout.

**Why this priority**: Production debugging is the highest-value use case. Without centralized, queryable logs, diagnosing live issues is slow and unreliable. This directly reduces mean time to resolution (MTTR).

**Independent Test**: Can be fully tested by triggering a workflow run (via Inngest Dev UI or a real event), then verifying the log entries appear in the centralized platform with all expected fields and can be found by filtering on `clientId`.

**Acceptance Scenarios**:

1. **Given** a workflow function runs and emits log statements, **When** the developer opens the log management platform, **Then** all log entries from that run appear within 10 seconds of being emitted, each carrying `clientId`, `env`, `level`, and `timestamp` fields.
2. **Given** multiple clients have workflow runs in the same time window, **When** the developer filters by a specific `clientId`, **Then** only log entries for that client are returned.
3. **Given** a workflow step throws an error, **When** the developer filters by `level: error`, **Then** the error entry appears with the full error message and any associated context fields.

---

### User Story 2 — No regressions at existing log call sites (Priority: P2)

A developer upgrades the logging library without needing to rewrite every call site in the codebase. The existing `log()` and `logError()` signatures continue to work, outputting structured data instead of formatted strings.

**Why this priority**: Preserving the existing API reduces risk and effort. A drop-in upgrade is far safer than a wide refactor across all Inngest functions and utilities.

**Independent Test**: Can be fully tested by verifying all existing call sites compile without changes and emit valid structured log entries in both dev (stdout) and production (centralized platform) modes.

**Acceptance Scenarios**:

1. **Given** the new logger is installed, **When** `log("message", { clientId: "abc" })` is called, **Then** a structured log entry is emitted with `level: info`, `msg: "message"`, `clientId: "abc"`, and `env` fields — no plain string concatenation.
2. **Given** `logError("failed", error, { clientId: "abc" })` is called, **Then** a structured entry is emitted with `level: error`, the error message, and all context fields.
3. **Given** the app runs locally in dev mode, **When** logs are emitted, **Then** they are printed to stdout in a human-readable format (not raw JSON).

---

### User Story 3 — Logs visible across all environments from one place (Priority: P3)

A developer can switch between `dev`, `preview`, and `production` log streams in the centralized platform without any extra setup, because each log entry carries an `env` field used for filtering.

**Why this priority**: Multi-environment visibility is a quality-of-life improvement for comparing behavior across deployments, but is not a blocker for core value.

**Independent Test**: Can be fully tested by triggering log events in two different environments and verifying both appear in the platform, filterable by `env`.

**Acceptance Scenarios**:

1. **Given** the app runs in two environments (`dev` and `production`), **When** the developer opens the platform, **Then** logs from both environments are visible and can be filtered by `env` field.
2. **Given** a new environment is introduced, **When** logs are emitted, **Then** they automatically appear in the platform with the correct `env` tag — no platform-side configuration required.

---

### Edge Cases

- What happens when the centralized platform is temporarily unreachable? Logs must not crash the application — transport failures must be swallowed silently (or written to stderr) so the primary workflow is unaffected.
- What happens if a log context object contains sensitive data (e.g., email addresses)? PII scrubbing is out of scope for this iteration, but the system must not actively expose new PII that wasn't already logged.
- What happens in local development with no platform credentials configured? The logger must still work (stdout only) without throwing or requiring environment variables to be set.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The logging system MUST emit log entries as structured data (key-value pairs), not raw concatenated strings.
- **FR-002**: Every log entry MUST include `level`, `msg`, `timestamp`, and `env` fields automatically — without requiring call sites to pass them.
- **FR-003**: Log entries MUST support arbitrary additional context fields (e.g., `clientId`, `functionName`) passed by the caller.
- **FR-004**: The logger MUST expose at minimum `info` and `error` severity methods that are backwards-compatible with the existing `log()` and `logError()` call signatures.
- **FR-005**: In local development, logs MUST be formatted for human readability in the terminal, not as raw structured data.
- **FR-006**: In production, logs MUST be transported to a centralized log management platform in near real-time (within 10 seconds of emission).
- **FR-007**: The centralized platform MUST provide a searchable web UI where log entries can be queried and filtered by any structured field.
- **FR-008**: The centralized platform MUST retain logs for a minimum of 30 days.
- **FR-009**: Log transport MUST be non-blocking — a slow or unavailable log platform MUST NOT degrade application throughput or cause workflow failures.
- **FR-010**: The solution MUST operate within the free tier of the chosen platform at current traffic volumes (single-digit clients, weekly workflow runs).
- **FR-011**: Platform credentials MUST be read from environment variables, and the logger MUST degrade gracefully (stdout-only) when those credentials are absent.

### Key Entities

- **Log Entry**: A single structured event with `level`, `msg`, `timestamp`, `env`, and optional caller-supplied context fields. The atomic unit transported to the platform.
- **Log Level**: A severity classification (`debug`, `info`, `warn`, `error`) that controls filtering both in the terminal and on the platform.
- **Transport**: The channel responsible for delivering log entries from the application to the centralized platform. Operates asynchronously and must not block the main execution path.
- **Logger**: The application-facing interface (`log()`, `logError()`) through which all instrumentation points emit events.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can locate any specific log event in the centralized platform within 5 seconds of knowing the `clientId` and approximate time — using only the platform's search/filter UI.
- **SC-002**: Log ingestion adds no perceptible latency to Inngest workflow steps — step execution time remains within 2% of the pre-upgrade baseline.
- **SC-003**: All log entries in the centralized platform include at minimum `level`, `msg`, `timestamp`, `env`, and `clientId` (where applicable) — verified by inspecting sampled entries across different workflow runs.
- **SC-004**: The solution operates entirely within the chosen platform's free tier for the first 12 months at current traffic volumes — confirmed by monitoring the platform's usage dashboard.
- **SC-005**: Zero existing call sites to `log()` or `logError()` require structural changes — only the logger implementation file changes, not its callers.
- **SC-006**: The application starts and emits logs correctly in local development without any platform credentials configured.

## Assumptions

- **Traffic volume**: Single-digit active clients with one workflow run per client per week. Total log volume is well under 1 GB/month — comfortably within free tier limits of most modern log platforms.
- **Platform choice**: Axiom is the assumed target platform. It offers 500 GB/month ingest and 30-day retention on its free tier, has an excellent query UI, and integrates natively with the fastest Node.js structured logging libraries. This assumption should be revisited if pricing or availability changes.
- **Logging library**: Pino is the assumed library. It is the fastest structured logger in the Node.js ecosystem and is widely adopted for production Node.js services. It supports pretty-printing in dev and JSON output in production out of the box.
- **Log level filtering**: All log levels are shown in all environments for this iteration. Fine-grained level suppression (e.g., suppress `debug` in production) is out of scope.
- **No distributed tracing**: Trace/span IDs and OpenTelemetry integration are out of scope. This spec covers structured logging only.
- **Single entry point**: `src/utils/logger.ts` is the sole logging entry point to replace. No direct `console.log` calls exist in business logic — all instrumentation already routes through `log()` / `logError()`.
