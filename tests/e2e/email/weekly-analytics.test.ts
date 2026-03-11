import { describe, it, expect, beforeAll } from "vitest";
import { triggerFlow, waitForRunCompletion } from "./helpers/inngest";
import { waitForEmail, type MailtrapMessage } from "./helpers/mailtrap";
import { FLOW_MAP } from "./flow-map";

const flow = FLOW_MAP["weekly-analytics"];

describe("Weekly Analytics Email — End-to-End", () => {
  let email: MailtrapMessage;

  beforeAll(async () => {
    const triggeredAt = new Date();
    const eventId = await triggerFlow(flow.event, flow.eventData);
    await waitForRunCompletion(eventId);
    email = await waitForEmail(/\[TEST:/i, triggeredAt);
  });

  // T009: Subject assertions
  it("has correct subject format with TEST prefix", () => {
    expect(email.subject).toMatch(/\[TEST:.*\]/i);
  });

  it("subject references analytics content", () => {
    expect(email.subject).toMatch(/analytics|report/i);
  });

  // T010: HTML body structural assertions
  it("delivers a non-empty HTML body", () => {
    expect(email.html_body).toBeTruthy();
    expect(email.html_body.length).toBeGreaterThan(100);
  });

  it("contains analytics-related content", () => {
    expect(email.html_body.toLowerCase()).toMatch(/analytics|report|weekly/);
  });

  it("includes a date or report period reference", () => {
    // At minimum a 4-digit year should appear in the report period
    expect(email.html_body).toMatch(/\d{4}/);
  });

  // T012: Template leakage / serialisation guards
  it("contains no raw template syntax", () => {
    expect(email.html_body).not.toContain("{{");
    expect(email.html_body).not.toContain("}}");
  });

  it("contains no serialisation artefacts", () => {
    expect(email.html_body).not.toContain("undefined");
    expect(email.html_body).not.toContain(">null<");
  });

  // T013: Populated value assertions
  it("contains at least one numeric metric value", () => {
    expect(email.html_body).toMatch(/\d+/);
  });
});
