import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";
import { config } from "../lib/config";

interface RunContext {
  runId: string;
  clientId?: string;
}

interface LogContext {
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<RunContext>();

export function setRunContext(ctx: RunContext): void {
  storage.enterWith(ctx);
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
  pinoLogger.info({ ...storage.getStore(), ...context }, message);
}

export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  pinoLogger.error({ ...storage.getStore(), ...(context ?? {}), err: error }, message);
}

export function flush(): void {
  pinoLogger.flush();
}
