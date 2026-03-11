export interface FlowConfig {
  /** File glob patterns that, when changed in a PR, trigger this flow's e2e test. */
  patterns: string[];
  /** Inngest event name to fire for this flow. */
  event: string;
  /** Event payload to send. clientId must match a seeded test client. */
  eventData: Record<string, unknown>;
  /** Relative path to the Vitest test file for this flow (within tests/e2e/email/). */
  testFile: string;
}

/**
 * Maps each email flow to its source file patterns, Inngest trigger, and test file.
 *
 * To register a new email flow:
 *  1. Add an entry here
 *  2. Create the corresponding test file at tests/e2e/email/<testFile>
 *  3. Add the path filter + conditional job in .github/workflows/e2e-email.yml
 */
export const FLOW_MAP: Record<string, FlowConfig> = {
  "weekly-analytics": {
    patterns: [
      "src/inngest/functions/analytics-report.ts",
      "src/inngest/functions/weekly-analytics-scheduler.ts",
    ],
    event: "analytics/report.requested",
    eventData: {
      clientId: "client-acme",
      reportPeriod: { preset: "last_week" },
      scheduledAt: new Date().toISOString(),
    },
    testFile: "weekly-analytics.test.ts",
  },

  "form-notification": {
    patterns: ["src/inngest/functions/form-notification.ts"],
    event: "form/submitted",
    eventData: {
      clientId: "client-acme",
      submitterName: "E2E Test User",
      submitterEmail: "e2e-test@example.com",
      submitterMessage: "This is an automated e2e test submission.",
      formId: "e2e-test-form",
    },
    testFile: "form-notification.test.ts",
  },
};

/**
 * Files that affect ALL email flows when changed.
 * When any of these are modified in a PR, all flow test suites run.
 */
export const SHARED_PATTERNS: string[] = [
  "src/lib/email.ts",
  "src/lib/config.ts",
  "src/inngest/functions/index.ts",
  "src/types/index.ts",
];
