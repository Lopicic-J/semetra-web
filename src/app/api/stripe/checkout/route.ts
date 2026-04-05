import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  stripe,
  STRIPE_PRO_PRICE_ID,
  isValidProPrice,
  isAiAddonPrice,
  isLifetimeBasicPrice,
  isLifetimeFullPrice,
} from "@/lib/stripe";
import { logger } from "@/lib/logger";

const log = logger("stripe:checkout");

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    // Parse body for price_id and optional mode
    let priceId = STRIPE_PRO_PRICE_ID;
    let isOneTime = false;
    try {
      const body = await req.json();
      if (body.price_id) {
        if (isValidProPrice(body.price_id)) {
          priceId = body.price_id;
        } else if (isAiAddonPrice(body.price_id)) {
          priceId = body.price_id;
          isOneTime = true;
        } else if (isLifetimeBasicPrice(body.price_id) || isLifetimeFullPrice(body.price_id)) {
          priceId = body.price_id;
          isOneTime = true;
        }
      }
      // Allow explicit mode override
      if (body.mode === "payment") {
        isOneTime = true;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    if (!priceId) {
      return NextResponse.json({ error: "Kein gültiger Preis konfiguriert." }, { status: 500 });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, full_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email ?? "",
        name: profile?.full_name ?? "",
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? "https://semetra-web.vercel.app";

    // Build checkout session params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: Record<string, any> = {
      customer: customerId,
      mode: isOneTime ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/upgrade?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade?canceled=1`,
      metadata: { supabase_user_id: user.id },
      allow_promotion_codes: true,
    };

    // Only add subscription_data for subscription mode
    if (!isOneTime) {
      sessionParams.subscription_data = {
        metadata: { supabase_user_id: user.id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    log.error("[stripe/checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout-Fehler." },
      { status: 500 }
    );
  }
}
