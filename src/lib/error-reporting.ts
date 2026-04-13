/**
 * Error Reporting — Centralized error tracking utility
 *
 * Captures errors from API routes and client components,
 * logs to Supabase error_logs table (if available) and console.
 *
 * Works alongside Sentry (which handles global-error.tsx).
 * This is for structured, queryable error tracking in our own DB.
 */

type ErrorSeverity = "low" | "medium" | "high" | "critical";
type ErrorSource = "api" | "client" | "worker" | "cron" | "webhook" | "plugin";

interface ErrorReport {
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  userId?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Report an error. Fire-and-forget — never throws.
 */
export async function reportError(report: ErrorReport): Promise<void> {
  try {
    // Always log to console with structured format
    const logEntry = {
      level: report.severity === "critical" ? "error" : report.severity === "high" ? "error" : "warn",
      source: report.source,
      message: report.message,
      endpoint: report.endpoint,
      userId: report.userId?.slice(0, 8), // Truncate for privacy
      timestamp: new Date().toISOString(),
    };

    if (report.severity === "critical" || report.severity === "high") {
      console.error("[error-report]", JSON.stringify(logEntry));
    } else {
      console.warn("[error-report]", JSON.stringify(logEntry));
    }

    // Try to persist to Supabase (best-effort)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase.from("error_logs").insert({
        source: report.source,
        severity: report.severity,
        message: report.message.slice(0, 1000), // Truncate
        stack: report.stack?.slice(0, 5000),
        user_id: report.userId,
        endpoint: report.endpoint,
        metadata: report.metadata,
      });
    }
  } catch {
    // Error reporting itself failed — only console
    console.error("[error-report] Failed to report error:", report.message);
  }
}

/**
 * Create a scoped reporter for a specific source.
 */
export function createReporter(source: ErrorSource, endpoint?: string) {
  return {
    low: (message: string, meta?: Record<string, unknown>) =>
      reportError({ source, severity: "low", message, endpoint, metadata: meta }),
    medium: (message: string, meta?: Record<string, unknown>) =>
      reportError({ source, severity: "medium", message, endpoint, metadata: meta }),
    high: (message: string, meta?: Record<string, unknown>) =>
      reportError({ source, severity: "high", message, endpoint, metadata: meta }),
    critical: (message: string, meta?: Record<string, unknown>) =>
      reportError({ source, severity: "critical", message, endpoint, metadata: meta }),

    /** Capture an error object with auto-extracted stack */
    capture: (err: unknown, severity: ErrorSeverity = "medium", meta?: Record<string, unknown>) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return reportError({ source, severity, message, stack, endpoint, metadata: meta });
    },
  };
}

/**
 * Wrap an async handler with automatic error reporting.
 * Useful for API route handlers.
 */
export function withErrorReporting<T extends (...args: unknown[]) => Promise<unknown>>(
  source: ErrorSource,
  endpoint: string,
  handler: T
): T {
  const reporter = createReporter(source, endpoint);

  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (err) {
      await reporter.capture(err, "high");
      throw err; // Re-throw so the caller can handle it too
    }
  }) as T;
}
