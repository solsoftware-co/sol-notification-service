import { describe, it, expect, beforeAll } from "vitest";
import { triggerFlow } from "./helpers/inngest";
import { waitForEmail, type MailtrapMessage } from "./helpers/mailtrap";
import { FLOW_MAP } from "./flow-map";

const flow = FLOW_MAP["form-notification"];

describe("Form Notification Email — End-to-End", () => {
  let email: MailtrapMessage;

  beforeAll(async () => {
    const triggeredAt = new Date();
    await triggerFlow(flow.event, flow.eventData);
    email = await waitForEmail(/\[TEST:/i, triggeredAt);
  });

  // Subject assertions
  it("has correct subject format with TEST prefix", () => {
    expect(email.subject).toMatch(/\[TEST:.*\]/i);
  });

  // Body structural assertions
  it("delivers a non-empty HTML body", () => {
    expect(email.html_body).toBeTruthy();
    expect(email.html_body.length).toBeGreaterThan(50);
  });

  it("contains form submission content", () => {
    // The notification email should surface the submitter's name or message
    expect(email.html_body).toMatch(/E2E Test User|automated e2e test/i);
  });

  // Template leakage / serialisation guards
  it("contains no raw template syntax", () => {
    expect(email.html_body).not.toContain("{{");
    expect(email.html_body).not.toContain("}}");
  });

  it("contains no serialisation artefacts", () => {
    expect(email.html_body).not.toContain("undefined");
    expect(email.html_body).not.toContain(">null<");
  });
});
