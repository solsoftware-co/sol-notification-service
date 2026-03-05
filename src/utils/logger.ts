import pino from "pino";
import { config } from "../lib/config";

interface LogContext {
  clientId?: string;
  [key: string]: unknown;
}

const isDev = config.env === "development";

const pinoLogger = pino({
  level: "info",
  base: { service: "sol-notification-service" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    bindings: (bindings) => ({ ...bindings, env: config.env }),
  },
  transport: {
    targets: isDev
      ? [{ target: "pino-pretty", level: "debug", options: { colorize: true } }]
      : config.logtailToken
        ? [{ target: "@logtail/pino", level: "info", options: { sourceToken: config.logtailToken } }]
        : [{ target: "pino/file", level: "info", options: { destination: 1 } }],
  },
});

export function log(message: string, context?: LogContext): void {
  pinoLogger.info({ ...context }, message);
}

export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  pinoLogger.error({ ...(context ?? {}), err: error }, message);
}

export function flush(): void {
  pinoLogger.flush();
}
