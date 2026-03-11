# Data Model: Automated End-to-End Email Testing in CI

**Feature**: `010-e2e-email-ci`
**Date**: 2026-03-07

> No database schema changes. This document describes the configuration structures and data shapes that the CI pipeline depends on.

---

## Flow Map Configuration

The central configuration object that maps each email flow to its source file patterns, Inngest trigger event, and test suite. Lives at `tests/e2e/email/flow-map.ts`.

```
FlowMap
├── [flowKey: string]
│   ├── patterns: string[]       # Glob patterns for files belonging to this flow
│   ├── event: string            # Inngest event name to trigger this flow
│   ├── eventData: object        # Payload to send with the trigger event
│   └── testFile: string         # Relative path to the Vitest test file for this flow
└── ...

SharedPatterns: string[]         # Files that trigger ALL flows when changed
```

**Example**:
```
weekly-analytics:
  patterns: ["src/inngest/functions/weekly-analytics*.ts"]
  event: "sol/weekly.analytics.report.requested"
  eventData: { clientId: "test-seed-client" }
  testFile: "weekly-analytics.test.ts"

form-notification:
  patterns: ["src/inngest/functions/form-notification.ts"]
  event: "sol/form.submitted"
  eventData: { clientId: "test-seed-client", formData: { ... } }
  testFile: "form-notification.test.ts"

SharedPatterns:
  - "src/lib/email.ts"
  - "src/lib/config.ts"
  - "src/inngest/functions/index.ts"
  - "src/types/index.ts"
```

---

## Mailtrap Message (API Response Shape)

The shape of a message object returned by the Mailtrap sandbox API (`GET /api/accounts/{accountId}/inboxes/{inboxId}/messages`). Key fields used by CI assertions:

```
MailtrapMessage
├── id: number                   # Unique message ID
├── subject: string              # Full subject line (includes [TEST: ...] prefix in test mode)
├── to_email: string             # Recipient address (= TEST_EMAIL)
├── from_email: string           # Sender address
├── html_body: string            # Rendered HTML body — used for content assertions
├── text_body: string            # Plain text alternative
└── created_at: string           # ISO 8601 timestamp — used for run isolation (timestamp window filter)
```

---

## CI Pipeline Run State

Conceptual state object tracked internally by the CI helper scripts during a single pipeline execution:

```
PipelineRun
├── flowKey: string              # Which email flow is being tested
├── previewUrl: string           # Vercel Preview deployment URL for this PR
├── triggeredAt: Date            # UTC timestamp recorded before sending Inngest event
├── eventId: string              # Inngest event ID returned from POST /e/:key
├── runStatus: string            # Inngest run status: "Completed" | "Failed" | "Cancelled"
└── email: MailtrapMessage       # The matched email from the test inbox (null if not received)
```

---

## GitHub Actions Job Outputs

Outputs passed between jobs in the workflow:

```
detect-changes job outputs:
├── weekly-analytics: "true" | "false"
├── form-notification: "true" | "false"
└── any-email: "true" | "false"   # true if any email-related files changed

wait-for-deployment job outputs:
└── url: string                   # Vercel Preview deployment URL

ci-gate job:
  (no outputs — exit code 0 = pass, non-zero = fail)
  runs with if: always()
  succeeds when all upstream job results are "success" or "skipped"
```
