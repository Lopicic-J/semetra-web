import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/plugins
 *
 * List all available plugins + user's installation status + purchase status.
 * Includes pricing_type, price_chf, legal info, and whether user has access.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Fetch profile for institution check
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, institution_id")
      .eq("id", user.id)
      .single();

    const isPro = profile?.plan === "pro";
    const hasInstitution = !!profile?.institution_id;

    const [pluginsRes, installedRes, purchasesRes] = await Promise.all([
      supabase.from("plugins").select("*").eq("active", true).order("name"),
      supabase.from("user_plugins").select("plugin_id, enabled, config").eq("user_id", user.id),
      supabase.from("plugin_purchases").select("plugin_id, granted_via, amount_chf").eq("user_id", user.id).eq("status", "completed"),
    ]);

    const installed = new Map(
      (installedRes.data ?? []).map(i => [i.plugin_id, i])
    );
    const purchased = new Map(
      (purchasesRes.data ?? []).map(p => [p.plugin_id, p])
    );

    const plugins = (pluginsRes.data ?? []).map(p => {
      const isPremium = p.pricing_type === "premium";
      const hasPurchased = purchased.has(p.id);
      const isFreeViaInstitution = isPremium && hasInstitution && isPro;

      // Access logic:
      // - Free plugins without requires_pro: always accessible
      // - Free plugins with requires_pro: only if user is Pro
      // - Premium + institution Pro user: accessible (auto-granted)
      // - Premium + purchased: accessible
      // - Premium + not purchased + no institution: not accessible
      const needsPro = p.requires_pro && !isPro;
      const canAccess = !needsPro && (!isPremium || hasPurchased || isFreeViaInstitution);

      return {
        ...p,
        installed: installed.has(p.id),
        enabled: installed.get(p.id)?.enabled ?? false,
        userConfig: installed.get(p.id)?.config ?? {},
        purchased: hasPurchased,
        purchaseMethod: purchased.get(p.id)?.granted_via ?? null,
        canAccess,
        isFreeViaInstitution,
        effectivePrice: isFreeViaInstitution ? 0 : (p.price_chf ?? 0),
      };
    });

    return NextResponse.json({ plugins, isPro, hasInstitution });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/plugins
 *
 * Install or toggle a plugin.
 * Body: { pluginId, action: "install"|"uninstall"|"toggle" }
 * Premium plugins require purchase or institution access.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { pluginId, action = "install" } = await req.json();
    if (!pluginId) return NextResponse.json({ error: "pluginId erforderlich" }, { status: 400 });

    // For install: check access to premium plugins
    if (action === "install") {
      const { data: plugin } = await supabase
        .from("plugins")
        .select("pricing_type")
        .eq("id", pluginId)
        .single();

      if (plugin?.pricing_type === "premium") {
        // Check if user has access (purchased or institution)
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, institution_id")
          .eq("id", user.id)
          .single();

        const isPro = profile?.plan === "pro";
        if (!isPro) {
          return NextResponse.json({ error: "Pro-Mitgliedschaft erforderlich." }, { status: 403 });
        }

        const hasInstitution = !!profile?.institution_id;
        if (!hasInstitution) {
          // Check purchase
          const { data: purchase } = await supabase
            .from("plugin_purchases")
            .select("id")
            .eq("user_id", user.id)
            .eq("plugin_id", pluginId)
            .eq("status", "completed")
            .single();

          if (!purchase) {
            return NextResponse.json(
              { error: "Plugin nicht erworben. Bitte zuerst kaufen." },
              { status: 403 }
            );
          }
        }
      }

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
