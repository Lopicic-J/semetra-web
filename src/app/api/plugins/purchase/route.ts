import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLUGIN_PRICE } from "@/lib/stripe";
import { logger } from "@/lib/logger";

const log = logger("plugins:purchase");

/**
 * POST /api/plugins/purchase
 *
 * Create a Stripe checkout session for a single plugin purchase (CHF 1.90).
 * - Institution-affiliated Pro users get it free (auto-granted).
 * - External Pro users must purchase.
 * - Free users are rejected.
 *
 * Body: { pluginId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

    const { pluginId } = await req.json();
    if (!pluginId) return NextResponse.json({ error: "pluginId erforderlich" }, { status: 400 });

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, institution_id, stripe_customer_id, email, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.plan !== "pro") {
      return NextResponse.json(
        { error: "Pro-Mitgliedschaft erforderlich für Premium-Plugins." },
        { status: 403 }
      );
    }

    // Check plugin exists and is premium
    const { data: plugin } = await supabase
      .from("plugins")
      .select("id, name, pricing_type, price_chf")
      .eq("id", pluginId)
      .eq("active", true)
      .single();

    if (!plugin) return NextResponse.json({ error: "Plugin nicht gefunden." }, { status: 404 });

    if (plugin.pricing_type === "free") {
      return NextResponse.json({ error: "Dieses Plugin ist kostenlos." }, { status: 400 });
    }

    // Check if already purchased
    const { data: existing } = await supabase
      .from("plugin_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("plugin_id", pluginId)
      .eq("status", "completed")
      .single();

    if (existing) {
      return NextResponse.json({ error: "Plugin bereits erworben." }, { status: 400 });
    }

    // Institution users get it free — auto-grant
    if (profile.institution_id) {
      const { error } = await supabase.from("plugin_purchases").upsert({
        user_id: user.id,
        plugin_id: pluginId,
        amount_chf: 0,
        status: "completed",
        granted_via: "institution",
        institution_id: profile.institution_id,
      }, { onConflict: "user_id,plugin_id" });

      if (error) {
        log.error("Institution auto-grant failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Also auto-install
      await supabase.from("user_plugins").upsert(
        { user_id: user.id, plugin_id: pluginId, enabled: true },
        { onConflict: "user_id,plugin_id" }
      );

      return NextResponse.json({ granted: true, method: "institution" });
    }

    // External user — create Stripe checkout
    if (!PLUGIN_PRICE.priceId) {
      return NextResponse.json(
        { error: "Plugin-Preis nicht konfiguriert. Bitte kontaktiere den Support." },
        { status: 500 }
      );
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile.email ?? "",
        name: profile.full_name ?? "",
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const reqOrigin = req.headers.get("origin");
    const origin = reqOrigin || new URL(req.url).origin || "https://semetra-web.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: PLUGIN_PRICE.priceId, quantity: 1 }],
      success_url: `${origin}/plugins?purchased=${pluginId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plugins?canceled=1`,
      metadata: {
        supabase_user_id: user.id,
        plugin_id: pluginId,
        type: "plugin_purchase",
      },
    });

    log.info(`[plugin-purchase] Checkout created for user ${user.id}, plugin ${pluginId}`);
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    log.error("[plugin-purchase]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Kauf." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plugins/purchase
 *
 * List user's plugin purchases.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { data, error } = await supabase
      .from("plugin_purchases")
      .select("plugin_id, amount_chf, status, granted_via, purchased_at")
      .eq("user_id", user.id)
      .eq("status", "completed");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ purchases: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 }
    );
  }
}
