import type { ClientRow, RecipientResolutionResult } from "../types/index";
import { logError } from "../utils/logger";

/**
 * Validates a single email address string.
 * Trims whitespace; requires non-empty result containing "@".
 */
function isValidEmail(entry: unknown): entry is string {
  if (typeof entry !== "string") return false;
  const trimmed = entry.trim();
  const atIndex = trimmed.indexOf("@");
  return atIndex > 0 && atIndex < trimmed.length - 1;
}

/**
 * Deduplicates an array of email addresses case-insensitively.
 * Preserves the casing of the first occurrence.
 */
function deduplicateEmails(addresses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const addr of addresses) {
    const key = addr.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(addr);
    }
  }
  return result;
}

/**
 * Validates, filters, and deduplicates a raw address list.
 * Logs a warning for each dropped entry.
 * Returns null if no valid addresses remain.
 */
function filterAddresses(
  raw: unknown[],
  context: { clientId: string; tier: string }
): string[] | null {
  const valid: string[] = [];
  for (const entry of raw) {
    if (isValidEmail(entry)) {
      valid.push(entry.trim());
    } else {
      logError(`resolveRecipients: invalid address skipped`, new Error(String(entry)), {
        clientId: context.clientId,
        tier: context.tier,
        address: entry,
      });
    }
  }
  if (valid.length === 0) return null;
  return deduplicateEmails(valid);
}

/**
 * Resolves the recipient list for a given workflow type using a three-tier fallback:
 *
 * 1. payloadRecipients — addresses provided at invocation time (per-request override)
 * 2. client.settings.notifications?.[workflowKey] — per-workflow stored list
 * 3. client.email — unconditional final fallback
 *
 * Returns the resolved list and the source tier for audit/logging purposes.
 * Always returns a non-empty `recipients` array.
 * Never throws — invalid entries are logged and discarded.
 */
export function resolveRecipients(
  client: ClientRow,
  workflowKey: string,
  payloadRecipients?: string[] | null
): RecipientResolutionResult {
  // Tier 1: payload-level override
  if (Array.isArray(payloadRecipients) && payloadRecipients.length > 0) {
    const valid = filterAddresses(payloadRecipients, { clientId: client.id, tier: "payload" });
    if (valid) {
      return { recipients: valid, source: "payload" };
    }
  }

  // Tier 2: per-workflow settings list
  const notifications = (client.settings as Record<string, unknown>)?.notifications;
  if (notifications && typeof notifications === "object" && !Array.isArray(notifications)) {
    const raw = (notifications as Record<string, unknown>)[workflowKey];
    if (Array.isArray(raw) && raw.length > 0) {
      const valid = filterAddresses(raw, { clientId: client.id, tier: "settings" });
      if (valid) {
        return { recipients: valid, source: "settings" };
      }
    }
  }

  // Tier 3: client primary email
  return { recipients: [client.email], source: "client_email" };
}
