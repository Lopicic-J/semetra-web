/**
 * Structured Logger for Semetra
 *
 * Lightweight, zero-dependency logger with namespace support.
 * Respects NODE_ENV: verbose in development, errors-only in production.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   const log = logger("api:grades");
 *   log.info("Grade created", { id: "g1", userId: "u1" });
 *   log.warn("Slow query", { duration: 450 });
 *   log.error("Insert failed", error);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = process.env.NODE_ENV === "development";
const minLevel: LogLevel = isDev ? "debug" : "warn";

interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

function formatMessage(level: LogLevel, namespace: string, message: string): string {
  if (isDev) {
    const time = new Date().toISOString().slice(11, 23);
    return `${time} [${level.toUpperCase()}] [${namespace}] ${message}`;
  }
  return `[${level.toUpperCase()}] [${namespace}] ${message}`;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

export function logger(namespace: string): Logger {
  return {
    debug(message: string, data?: unknown) {
      if (!shouldLog("debug")) return;
      if (data !== undefined) {
        console.debug(formatMessage("debug", namespace, message), data);
      } else {
        console.debug(formatMessage("debug", namespace, message));
      }
    },
    info(message: string, data?: unknown) {
      if (!shouldLog("info")) return;
      if (data !== undefined) {
        console.log(formatMessage("info", namespace, message), data);
      } else {
        console.log(formatMessage("info", namespace, message));
      }
    },
    warn(message: string, data?: unknown) {
      if (!shouldLog("warn")) return;
      if (data !== undefined) {
        console.warn(formatMessage("warn", namespace, message), data);
      } else {
        console.warn(formatMessage("warn", namespace, message));
      }
    },
    error(message: string, data?: unknown) {
      if (!shouldLog("error")) return;
      if (data !== undefined) {
        console.error(formatMessage("error", namespace, message), data);
      } else {
        console.error(formatMessage("error", namespace, message));
      }
    },
  };
}

/** Convenience: pre-built loggers for common namespaces */
export const log = {
  api: logger("api"),
  auth: logger("auth"),
  ai: logger("ai"),
  stripe: logger("stripe"),
  academic: logger("academic"),
  pwa: logger("pwa"),
  ui: logger("ui"),
};
