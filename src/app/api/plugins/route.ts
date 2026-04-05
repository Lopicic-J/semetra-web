import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/plugins
 *
 * List all available plugins + user's installation status.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const [pluginsRes, installedRes] = await Promise.all([
      supabase.from("plugins").select("*").eq("active", true).order("name"),
      supabase.from("user_plugins").select("plugin_id, enabled, config").eq("user_id", user.id),
    ]);

    const installed = new Map(
      (installedRes.data ?? []).map(i => [i.plugin_id, i])
    );

    const plugins = (pluginsRes.data ?? []).map(p => ({
      ...p,
      installed: installed.has(p.id),
      enabled: installed.get(p.id)?.enabled ?? false,
      userConfig: installed.get(p.id)?.config ?? {},
    }));

    return NextResponse.json({ plugins });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/plugins
 *
 * Install or toggle a plugin.
 * Body: { pluginId, action: "install"|"uninstall"|"toggle" }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { pluginId, action = "install" } = await req.json();
    if (!pluginId) return NextResponse.json({ error: "pluginId erforderlich" }, { status: 400 });

    if (action === "install") {
      const { error } = await supabase
        .from("user_plugins")
        .upsert({ user_id: user.id, plugin_id: pluginId, enabled: true }, { onConflict: "user_id,plugin_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "uninstall") {
      await supabase.from("user_plugins").delete().eq("user_id", user.id).eq("plugin_id", pluginId);
    } else if (action === "toggle") {
      const { data: existing } = await supabase
        .from("user_plugins").select("enabled").eq("user_id", user.id).eq("plugin_id", pluginId).single();
      if (existing) {
        await supabase.from("user_plugins")
          .update({ enabled: !existing.enabled })
          .eq("user_id", user.id).eq("plugin_id", pluginId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * PATCH /api/plugins
 *
 * Update plugin configuration.
 * Body: { pluginId, config: { ... } }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { pluginId, config } = await req.json();
    if (!pluginId) return NextResponse.json({ error: "pluginId erforderlich" }, { status: 400 });
    if (!config) return NextResponse.json({ error: "config erforderlich" }, { status: 400 });

    const { error } = await supabase
      .from("user_plugins")
      .update({ config })
      .eq("user_id", user.id)
      .eq("plugin_id", pluginId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Speichern" },
      { status: 500 }
    );
  }
}
