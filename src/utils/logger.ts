import { config } from "../lib/config";

interface LogContext {
  clientId?: string;
  [key: string]: unknown;
}

function formatPrefix(context?: LogContext): string {
  const envTag = `[${config.env}]`;
  const clientTag =
    context?.clientId ? ` [clientId=${context.clientId}]` : "";
  return `${envTag}${clientTag}`;
}

function formatContext(context?: LogContext): string {
  if (!context) return "";
  const { clientId: _clientId, ...rest } = context;
  const keys = Object.keys(rest);
  if (keys.length === 0) return "";
  return " " + JSON.stringify(rest);
}

export function log(message: string, context?: LogContext): void {
  console.log(`${formatPrefix(context)} ${message}${formatContext(context)}`);
}

export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  console.error(
    `${formatPrefix(context)} ERROR: ${message} — ${errorMessage}${formatContext(context)}`
  );
}
