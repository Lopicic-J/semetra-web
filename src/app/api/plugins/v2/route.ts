/**
 * /api/plugins/v2 — Plugin API v2
 *
 * Enhanced plugin management with:
 *   - GET:  List plugins with extended metadata, execution stats, scopes
 *   - POST: Batch execute multiple plugin actions
 *   - PUT:  Update plugin config with schema validation
 *
 * Supersedes parts of the v1 API while maintaining backwards compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPluginScope, checkRateLimit } from "@/lib/plugins/sandbox";

interface UserPluginRow {
  plugin_id: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  installed_at: string;
}

interface PluginRow {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  pricing_type: string;
  price_chf: number | null;
  config_schema: Record<string, unknown> | null;
  active: boolean;
}

interface ExecutionLogRow {
  plugin_id: string;
  count: number;
}

/**
 * GET — Extended plugin catalog with scopes and user stats
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all active plugins
  const { data: pluginsRaw } = await supabase
    .from("plugins")
    .select("id, name, description, version, category, pricing_type, price_chf, config_schema, active")
    .eq("active", true)
    .order("name");

  const plugins = (pluginsRaw ?? []) as PluginRow[];

  // Fetch user's installations
  const { data: userPluginsRaw } = await supabase
    .from("user_plugins")
    .select("plugin_id, enabled, config, installed_at")
    .eq("user_id", user.id);

  const userPlugins = (userPluginsRaw ?? []) as UserPluginRow[];
  const userMap = new Map(userPlugins.map((up) => [up.plugin_id, up]));

  // Fetch execution counts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: execLogsRaw } = await supabase
    .from("plugin_executions")
    .select("plugin_id")
    .eq("user_id", user.id)
    .gte("executed_at", thirtyDaysAgo.toISOString());

  // Count per plugin
  const execCounts = new Map<string, number>();
  for (const row of (execLogsRaw ?? []) as { plugin_id: string }[]) {
    execCounts.set(row.plugin_id, (execCounts.get(row.plugin_id) ?? 0) + 1);
  }

  // Build enriched response
  const enriched = plugins.map((p) => {
    const userPlugin = userMap.get(p.id);
    const scope = getPluginScope(p.id);

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      category: p.category,
      pricingType: p.pricing_type,
      priceCHF: p.price_chf,
      configSchema: p.config_schema,

      // User state
      installed: !!userPlugin,
      enabled: userPlugin?.enabled ?? false,
      config: userPlugin?.config ?? null,
      installedAt: userPlugin?.installed_at ?? null,

      // Security
      scope: {
        tables: scope.tables.map((t) => t.name),
        allowWebhooks: scope.allowWebhooks,
        allowExport: scope.allowExport,
        maxRows: scope.maxRows,
      },

      // Usage
      executionsLast30d: execCounts.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ plugins: enriched, apiVersion: "v2" });
}

/**
 * POST — Batch execute plugin actions
 *
 * Body: { actions: [{ pluginId, action, params }] }
 * Max 5 actions per batch.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { actions } = await req.json();

  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ error: "actions array required" }, { status: 400 });
  }

  if (actions.length > 5) {
    return NextResponse.json({ error: "Maximum 5 actions per batch" }, { status: 400 });
  }

  // Verify all plugins are installed + enabled
  const pluginIds = [...new Set(actions.map((a: { pluginId: string }) => a.pluginId))];
  const { data: userPluginsRaw } = await supabase
    .from("user_plugins")
    .select("plugin_id, enabled")
    .eq("user_id", user.id)
    .in("plugin_id", pluginIds);

  const installedMap = new Map(
    ((userPluginsRaw ?? []) as { plugin_id: string; enabled: boolean }[]).map((up) => [
      up.plugin_id,
      up.enabled,
    ])
  );

  const results: Array<{
    pluginId: string;
    action: string;
    success: boolean;
    error?: string;
    data?: unknown;
    durationMs: number;
  }> = [];

  for (const act of actions as Array<{ pluginId: string; action?: string; params?: Record<string, unknown> }>) {
    const start = Date.now();

    // Check installed
    if (!installedMap.has(act.pluginId)) {
      results.push({
        pluginId: act.pluginId,
        action: act.action ?? "default",
        success: false,
        error: "Plugin nicht installiert",
        durationMs: Date.now() - start,
      });
      continue;
    }

    // Check enabled
    if (!installedMap.get(act.pluginId)) {
      results.push({
        pluginId: act.pluginId,
        action: act.action ?? "default",
        success: false,
        error: "Plugin deaktiviert",
        durationMs: Date.now() - start,
      });
      continue;
    }

    // Rate limit per plugin
    const rateCheck = checkRateLimit(user.id, act.pluginId);
    if (!rateCheck.allowed) {
      results.push({
        pluginId: act.pluginId,
        action: act.action ?? "default",
        success: false,
        error: "Rate limit erreicht",
        durationMs: Date.now() - start,
      });
      continue;
    }

    // Execute via internal v1 endpoint (reuse existing logic)
    try {
      const execRes = await fetch(new URL("/api/plugins/execute", req.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          pluginId: act.pluginId,
          action: act.action,
          ...act.params,
        }),
      });

      const execData = await execRes.json();

      // Log execution
      await supabase.from("plugin_executions").insert({
        user_id: user.id,
        plugin_id: act.pluginId,
        action: act.action ?? "default",
        success: execRes.ok,
        duration_ms: Date.now() - start,
        executed_at: new Date().toISOString(),
      });

      results.push({
        pluginId: act.pluginId,
        action: act.action ?? "default",
        success: execRes.ok,
        data: execRes.ok ? execData : undefined,
        error: execRes.ok ? undefined : execData.error,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        pluginId: act.pluginId,
        action: act.action ?? "default",
        success: false,
        error: err instanceof Error ? err.message : "Execution failed",
        durationMs: Date.now() - start,
      });
    }
  }

  return NextResponse.json({ results, apiVersion: "v2" });
}

/**
 * PUT — Update plugin configuration with schema validation
 *
 * Body: { pluginId, config: { ... } }
 */
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pluginId, config } = await req.json();

  if (!pluginId || !config || typeof config !== "object") {
    return NextResponse.json({ error: "pluginId and config object required" }, { status: 400 });
  }

  // Get plugin's config schema
  const { data: plugin } = await supabase
    .from("plugins")
    .select("config_schema")
    .eq("id", pluginId)
    .single();

  if (!plugin) {
    return NextResponse.json({ error: "Plugin nicht gefunden" }, { status: 404 });
  }

  // Basic schema validation (check required fields and types)
  const schema = plugin.config_schema as Record<string, { type: string; required?: boolean; default?: unknown }> | null;
  if (schema) {
    const errors: string[] = [];
    for (const [key, def] of Object.entries(schema)) {
      if (def.required && !(key in config)) {
        errors.push(`Feld "${key}" ist erforderlich`);
      }
      if (key in config && def.type) {
        const actual = typeof config[key];
        if (actual !== def.type) {
          errors.push(`"${key}" muss ${def.type} sein, ist aber ${actual}`);
        }
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: "Config Validierung fehlgeschlagen", details: errors }, { status: 400 });
    }
  }

  // Update config
  const { error } = await supabase
    .from("user_plugins")
    .update({ config })
    .eq("user_id", user.id)
    .eq("plugin_id", pluginId);

  if (error) {
    console.error("[plugin-v2] Config update error:", error);
    return NextResponse.json({ error: "Config Update fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pluginId });
}
