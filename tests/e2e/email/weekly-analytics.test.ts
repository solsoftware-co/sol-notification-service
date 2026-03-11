import { describe, it, expect, beforeAll } from "vitest";
import { triggerFlow } from "./helpers/inngest";
import { waitForEmail, getEmailAttachments, type MailtrapMessage, type Attachment } from "./helpers/mailtrap";
import { FLOW_MAP } from "./flow-map";

const flow = FLOW_MAP["weekly-analytics"];

describe("Weekly Analytics Email — End-to-End", () => {
  let email: MailtrapMessage;
  let attachments: Attachment[];

  beforeAll(async () => {
    const triggeredAt = new Date();
    await triggerFlow(flow.event, flow.eventData);
    email = await waitForEmail(/\[TEST:.*\].*(?:analytics|report)/i, triggeredAt);
    attachments = await getEmailAttachments(email.id);
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

  // T014: Inline image attachment assertions
  it("includes the banner image as an inline attachment", () => {
    const banner = attachments.find((a) => a.content_id === "banner_image.png");
    expect(banner).toBeDefined();
    expect(banner?.content_type).toMatch(/image/);
  });

  it("includes the analytics chart as an inline attachment", () => {
    const chart = attachments.find((a) => a.filename.match(/chart|graph|analytics/i));
    expect(chart).toBeDefined();
    expect(chart?.content_type).toMatch(/image/);
  });
});
