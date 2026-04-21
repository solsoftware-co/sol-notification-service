# Feature Specification: Improve Inngest Function Logging

**Feature Branch**: `023-improve-function-logging`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Rewrite log messages across all Inngest functions to be plain-English sentences that embed the key values inline, so reading the log output tells a clear story of what happened."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow Workflow Execution in Logs (Priority: P1)

An on-call engineer opens the log stream during an incident and needs to understand what each Inngest function is doing without cross-referencing the code. Today they see `"Workflow started" { clientId: "acme-corp" }` and must open the source to understand the context. After this change, each log line is a self-contained sentence: `Analytics report started for client acme-corp — period: last_week (Apr 14 – Apr 20, 2025)`.

**Why this priority**: The primary motivation for this change is operational clarity — engineers must be able to triage issues from logs alone.

**Independent Test**: Can be tested by running any single function in dev mode and reading its terminal output without consulting source code.

**Acceptance Scenarios**:

1. **Given** a form notification workflow executes for client `acme-corp`, **When** the log output is read, **Then** each line names the client, the action, and relevant identifiers (recipient emails, sheet ID) inline in the message string.
2. **Given** a weekly analytics scheduler runs for 3 clients, **When** the log output is read, **Then** the output reads as a clear narrative: triggered, count of clients, dispatch per client with position (1 of 3).
3. **Given** an analytics report workflow executes, **When** the log output is read, **Then** the log identifies the GA4 property, date range, and recipient email in the messages without requiring the context object to be parsed.

---

### User Story 2 - Retain Structured Filtering Capability (Priority: P2)

A developer uses a log-aggregation tool (e.g., Better Stack) to filter all log lines for a specific `clientId`. Even after the log messages become verbose plain-English sentences, they can still filter by `clientId` in the structured context object.

**Why this priority**: Plain-English messages improve readability, but the structured `clientId` context field is needed for programmatic filtering and alerting. Both must coexist.

**Independent Test**: Can be tested by checking that `log()` calls pass `clientId` as the second argument alongside the new descriptive message.

**Acceptance Scenarios**:

1. **Given** a log call is made inside an Inngest function, **When** the log entry is inspected, **Then** `clientId` appears in the structured context object (second argument to `log()`) even when it is also embedded in the message string.

---

### User Story 3 - Logs at Action Boundaries Inside Steps (Priority: P3)

A developer reviews the logs for a failed analytics report and can see exactly which action failed — the GA4 query, the email send, or the sheet write — because each action boundary is logged before it begins.

**Why this priority**: Start/end workflow logs are not sufficient for debugging mid-step failures. Action-boundary logs inside steps narrow the blast radius.

**Independent Test**: Can be tested by inspecting each step in each function for a "before action" log immediately preceding the significant I/O call.

**Acceptance Scenarios**:

1. **Given** an analytics report step is running, **When** the GA4 query step begins, **Then** a log line such as `Querying GA4 property 123456789 for client acme-corp` appears before the query executes.
2. **Given** an email send step is running, **When** the send call is about to be made, **Then** a log line such as `Sending analytics report email to owner@acme.com` appears before the send.
3. **Given** a Google Sheet write step is running, **When** the write is about to begin, **Then** a log line such as `Writing form submission to Google Sheet <sheetId>` appears before the write.

---

### Edge Cases

- What happens when a value that should be embedded (e.g., `recipientEmail`, `propertyId`) is undefined or null at log time? Log the best available fallback (e.g., `"(unknown)"`) rather than throwing or emitting a confusing `undefined`.
- What if a function has no meaningful action boundary inside a step (trivial branches or pure computation)? No log is added — only action boundaries that represent external I/O (fetches, sends, writes) warrant a log.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Log messages in `form-notification.ts` MUST embed `clientId`, recipient email addresses, and spreadsheet ID (when applicable) directly in the message string.
- **FR-002**: Log messages in `weekly-analytics-scheduler.ts` MUST embed the total number of active clients and per-client dispatch position (e.g., "1 of 3") in the message string.
- **FR-003**: Log messages in `analytics-report.ts` (or equivalent per-client worker) MUST embed `clientId`, GA4 property ID, date range (human-readable), and recipient email in the message string.
- **FR-004**: All updated `log()` calls MUST continue passing `clientId` as a field in the structured context object (second argument) to preserve log-aggregation filtering.
- **FR-005**: A log call MUST appear immediately before each significant external I/O action within a step (GA4 query, email send, sheet write) — not just at workflow start/end.
- **FR-006**: No new log calls MUST be added for trivial branching or pure computation — only action boundaries.
- **FR-007**: All updated messages MUST be complete English sentences or short imperative phrases that are self-explanatory without reading the context object.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An engineer unfamiliar with the codebase can determine what a workflow did, for which client, and to which recipients by reading only the log lines — without opening any source file.
- **SC-002**: Every significant external I/O call (GA4 query, Resend email, Google Sheets write) is preceded by a log line that names the target resource and client.
- **SC-003**: All three target function files (`form-notification.ts`, `weekly-analytics-scheduler.ts`, analytics report worker) have updated log messages with no generic `"Workflow started"` / `"Workflow completed"` messages remaining in their original form.
- **SC-004**: Log filtering by `clientId` in a structured-log aggregator continues to return the correct set of log lines after the change.

## Assumptions

- The existing `log()` utility signature `log(message: string, context?: object)` is unchanged — this feature only changes the content of the `message` argument and ensures `clientId` stays in `context`.
- "Analytics report worker" refers to the file currently handling per-client GA4 fetching and email sending (likely `weekly-analytics-report.ts` or `analytics-report.ts`).
- Date range formatting uses the same format already produced by the analytics report function for the period label (e.g., `Apr 14 – Apr 20, 2025`).
- No new log levels, transports, or third-party logging configuration changes are in scope.
