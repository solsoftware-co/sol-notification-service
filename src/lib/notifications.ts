import type { ClientRow } from "../types/index";
import { logError } from "../utils/logger";

/**
 * Resolves the recipient list for a given workflow type from a client's settings.
 *
 * Resolution order:
 * 1. Read client.settings.notifications?.[workflowKey]
 * 2. If absent or not an array → return [client.email]
 * 3. Filter: keep strings that are non-empty and contain "@"; log a warning per dropped address
 * 4. If filtered array is empty → return [client.email]
 * 5. Return filtered array
 *
 * Always returns a non-empty string[].
 */
export function resolveRecipients(client: ClientRow, workflowKey: string): string[] {
  const notifications = (client.settings as Record<string, unknown>)?.notifications;

  if (!notifications || typeof notifications !== "object" || Array.isArray(notifications)) {
    return [client.email];
  }

  const raw = (notifications as Record<string, unknown>)[workflowKey];

  if (!Array.isArray(raw)) {
    return [client.email];
  }

  const valid: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.length > 0 && entry.includes("@")) {
      valid.push(entry);
    } else {
      logError(`resolveRecipients: invalid address skipped`, {
        clientId: client.id,
        workflowKey,
        address: entry,
      });
    }
  }

  return valid.length > 0 ? valid : [client.email];
}
