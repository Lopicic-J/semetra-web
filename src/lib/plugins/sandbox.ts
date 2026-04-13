/**
 * Plugin Sandbox — Security Layer for Plugin Execution
 *
 * Enforces:
 *   1. Rate limiting per user per plugin
 *   2. Payload size limits
 *   3. Execution timeout tracking
 *   4. Allowed table scoping (plugins can only access specific tables)
 *   5. Read-only vs read-write permission enforcement
 *
 * This is a server-side-only module — plugins never run client-side code.
 */

/** Maximum payload size a plugin can receive or return (500 KB) */
export const MAX_PAYLOAD_SIZE = 512 * 1024;

/** Maximum execution time for a plugin action (15 seconds) */
export const MAX_EXECUTION_MS = 15_000;

/** Rate limit: max executions per plugin per user per hour */
export const RATE_LIMIT_PER_HOUR = 60;

/**
 * Define what each plugin is allowed to access.
 * "read" = SELECT only, "write" = SELECT + INSERT + UPDATE
 */
export interface PluginScope {
  tables: {
    name: string;
    permissions: ("read" | "write")[];
  }[];
  allowWebhooks: boolean;
  allowExport: boolean;
  maxRows: number;
}

/** Plugin scope definitions — hardcoded per plugin ID */
const PLUGIN_SCOPES: Record<string, PluginScope> = {
  "grade-export": {
    tables: [
      { name: "grades", permissions: ["read"] },
      { name: "modules", permissions: ["read"] },
    ],
    allowWebhooks: false,
    allowExport: true,
    maxRows: 5000,
  },
  "pomodoro-plus": {
    tables: [
      { name: "time_logs", permissions: ["read"] },
    ],
    allowWebhooks: false,
    allowExport: false,
    maxRows: 1000,
  },
  "calendar-sync": {
    tables: [
      { name: "events", permissions: ["read", "write"] },
      { name: "exams", permissions: ["read"] },
    ],
    allowWebhooks: true,
    allowExport: false,
    maxRows: 500,
  },
  "moodle-sync": {
    tables: [
      { name: "grades", permissions: ["read", "write"] },
      { name: "modules", permissions: ["read"] },
      { name: "exams", permissions: ["read", "write"] },
    ],
    allowWebhooks: true,
    allowExport: false,
    maxRows: 2000,
  },
  "notion-import": {
    tables: [
      { name: "notes", permissions: ["read", "write"] },
      { name: "tasks", permissions: ["read", "write"] },
    ],
    allowWebhooks: false,
    allowExport: false,
    maxRows: 1000,
  },
};

/** Default restrictive scope for unknown plugins */
const DEFAULT_SCOPE: PluginScope = {
  tables: [],
  allowWebhooks: false,
  allowExport: false,
  maxRows: 100,
};

/**
 * Get the security scope for a plugin.
 */
export function getPluginScope(pluginId: string): PluginScope {
  return PLUGIN_SCOPES[pluginId] ?? DEFAULT_SCOPE;
}

/**
 * Check if a plugin has permission to access a specific table with a specific operation.
 */
export function canAccessTable(
  pluginId: string,
  tableName: string,
  operation: "read" | "write"
): boolean {
  const scope = getPluginScope(pluginId);
  const tableScope = scope.tables.find((t) => t.name === tableName);
  if (!tableScope) return false;
  return tableScope.permissions.includes(operation);
}

/**
 * Validate payload size. Returns error message if too large.
 */
export function validatePayloadSize(payload: unknown): string | null {
  const size = JSON.stringify(payload).length;
  if (size > MAX_PAYLOAD_SIZE) {
    return `Payload too large: ${Math.round(size / 1024)}KB exceeds ${MAX_PAYLOAD_SIZE / 1024}KB limit`;
  }
  return null;
}

/**
 * In-memory rate limiter (per-process; use Redis in production for multi-instance).
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, pluginId: string): { allowed: boolean; remaining: number } {
  const key = `${userId}:${pluginId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 3600_000 });
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - 1 };
  }

  if (entry.count >= RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - entry.count };
}

/**
 * Create a sandbox context for plugin execution.
 * Returns timing + scope helpers.
 */
export function createSandboxContext(pluginId: string, userId: string) {
  const startTime = Date.now();
  const scope = getPluginScope(pluginId);

  return {
    scope,
    pluginId,
    userId,

    /** Check if execution has exceeded time limit */
    isTimedOut(): boolean {
      return Date.now() - startTime > MAX_EXECUTION_MS;
    },

    /** Get elapsed ms */
    elapsed(): number {
      return Date.now() - startTime;
    },

    /** Verify table access */
    assertTableAccess(table: string, op: "read" | "write"): void {
      if (!canAccessTable(pluginId, table, op)) {
        throw new PluginSandboxError(
          `Plugin "${pluginId}" has no ${op} access to table "${table}"`
        );
      }
    },
  };
}

export class PluginSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginSandboxError";
  }
}
