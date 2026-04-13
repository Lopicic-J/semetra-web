/**
 * Plugin Execution Logger
 *
 * Logs every plugin execution to the plugin_executions table.
 * Used by both v1 execute route and v2 batch API.
 *
 * Fire-and-forget — failures are logged but never block the response.
 */

import { createClient } from "@/lib/supabase/server";

interface ExecutionLog {
  userId: string;
  pluginId: string;
  action: string;
  success: boolean;
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a plugin execution. Does not throw.
 */
export async function logPluginExecution(entry: ExecutionLog): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("plugin_executions").insert({
      user_id: entry.userId,
      plugin_id: entry.pluginId,
      action: entry.action,
      success: entry.success,
      duration_ms: entry.durationMs,
      error_message: entry.error ?? null,
      metadata: entry.metadata ?? null,
      executed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[plugin-logger] Failed to log execution:", err);
  }
}

/**
 * Fire-and-forget wrapper for use in API routes.
 */
export function logPluginExecutionAsync(entry: ExecutionLog): void {
  logPluginExecution(entry).catch(() => {
    // Swallowed intentionally — logging should never fail the request
  });
}
