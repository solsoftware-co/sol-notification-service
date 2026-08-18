import { inngest } from "../client";
import { getClientSlackCredentials, writeNotificationLog } from "../../lib/sol-api";
import { postSlackMessage } from "../../lib/slack";
import { log, logError, setRunContext } from "../../utils/logger";
import type { SlackMessageRequestedPayload } from "../../types/index";

const REQUIRED_FIELDS: (keyof SlackMessageRequestedPayload)[] = ["clientId", "text"];

export const sendSlackMessage = inngest.createFunction(
  {
    id: "send-slack-message",
    retries: 3,
    onFailure: async ({ event, error, step }) => {
      const originalData = event.data.event.data as SlackMessageRequestedPayload;
      const clientId = originalData.clientId;
      setRunContext({ runId: event.data.run_id, clientId });
      logError(`Slack message permanently failed for client ${clientId}`, error);

      await step.run("log-terminal-failure", async () => {
        await writeNotificationLog({
          client_id: clientId,
          workflow: "send-slack-message",
          event_name: "slack/message.requested",
          outcome: "failed",
          subject: originalData.text?.slice(0, 100),
          error_message: error.message,
          metadata: { text: originalData.text },
        });
      });
    },
  },
  { event: "slack/message.requested" },
  async ({ event, step, runId }) => {
    const data = event.data as SlackMessageRequestedPayload;
    const clientId = data.clientId;

    setRunContext({ runId, clientId });
    log(`slack/message.requested received for client ${clientId}`);

    await step.run("validate-payload", async () => {
      for (const field of REQUIRED_FIELDS) {
        if (!data[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    });

    const result = await step.run("send-slack-message", async () => {
      setRunContext({ runId, clientId });
      const { slack_webhook_url } = await getClientSlackCredentials(clientId);
      if (!slack_webhook_url) {
        return { skipped: true, reason: "no Slack webhook configured for client" } as const;
      }
      log(`Sending Slack message for client ${clientId}`);
      await postSlackMessage(slack_webhook_url, { text: data.text, blocks: data.blocks });
      return { skipped: false } as const;
    });

    await step.run("log-result", async () => {
      setRunContext({ runId, clientId });
      if (result.skipped) {
        log(`Slack message skipped for client ${clientId} — ${result.reason}`);
        return;
      }
      log(`Slack message sent for client ${clientId}`);
      await writeNotificationLog({
        client_id: clientId,
        workflow: "send-slack-message",
        event_name: "slack/message.requested",
        outcome: "sent",
        subject: data.text.slice(0, 100),
        metadata: { text: data.text },
      });
    });

    return { clientId, outcome: result.skipped ? "skipped" : "sent" };
  }
);
