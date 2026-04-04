import { NextRequest, NextResponse } from "next/server";
import {
  stripe,
  isAiAddonPrice,
  AI_ADDON_PRICE,
  isLifetimeFullPrice,
  getTierFromPriceId,
} from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Use service-role key so webhook can bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[webhook] handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Try to find user by metadata or Stripe customer ID
  let userId = session.metadata?.supabase_user_id ?? null;

  if (!userId && session.customer) {
    userId = await getUserIdFromCustomer(session.customer as string);
  }

  // For one-time payments, also try by email
  if (!userId && session.customer_details?.email) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", session.customer_details.email)
      .single();
    userId = data?.id ?? null;
  }

  if (!userId) {
    console.warn("[webhook] No user found for session:", session.id);
    return;
  }

  // One-time payment: could be Lifetime Basic, Lifetime Full, or AI Add-on
  if (session.mode === "payment") {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });

    // Check for AI Add-on purchase
    const addonItem = lineItems.data.find((item: Stripe.LineItem) => item.price && isAiAddonPrice(item.price.id));
    if (addonItem) {
      const credits = AI_ADDON_PRICE.credits;
      const month = currentMonth();
      await supabaseAdmin.rpc("add_addon_credits", {
        p_user_id: userId,
        p_month: month,
        p_credits: credits,
      });
      console.log(`[webhook] AI Add-on: +${credits} credits for user ${userId} (month: ${month})`);
      return;
    }

    // Check for Lifetime Full
    const lifetimeFullItem = lineItems.data.find((item: Stripe.LineItem) => item.price && isLifetimeFullPrice(item.price.id));
    const tier = lifetimeFullItem ? "full" : "basic";

    await supabaseAdmin.from("profiles").update({
      plan: "pro",
      plan_type: "lifetime",
      plan_tier: tier,
      stripe_subscription_status: null,
      stripe_customer_id: (session.customer as string) ?? null,
      plan_expires_at: null,
    }).eq("id", userId);
    console.log(`[webhook] Lifetime ${tier} activated for user:`, userId);
    return;
  }

  // Subscription-based purchase
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.warn("[webhook] No subscription in session:", session.id);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const tier = getTierFromPriceId(priceId) ?? "basic";

  await supabaseAdmin.from("profiles").update({
    plan: "pro",
    plan_type: "subscription",
    plan_tier: tier,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_status: subscription.status,
    stripe_price_id: priceId,
    plan_expires_at: null,
    stripe_customer_id: session.customer as string,
  }).eq("id", userId);

  console.log(`[webhook] Pro ${tier} subscription activated for user:`, userId);
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id
    ?? await getUserIdFromCustomer(sub.customer as string);

  if (!userId) return;

  const isActive = sub.status === "active" || sub.status === "trialing";
  const priceId = sub.items.data[0]?.price.id ?? "";
  const tier = getTierFromPriceId(priceId) ?? "basic";

  await supabaseAdmin.from("profiles").update({
    plan: isActive ? "pro" : "free",
    plan_tier: isActive ? tier : null,
    stripe_subscription_id: sub.id,
    stripe_subscription_status: sub.status,
    stripe_price_id: priceId,
    plan_expires_at: sub.cancel_at
      ? new Date(sub.cancel_at * 1000).toISOString()
      : null,
  }).eq("id", userId);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id
    ?? await getUserIdFromCustomer(sub.customer as string);

  if (!userId) return;

  // Don't downgrade Lifetime users when a subscription is deleted
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan_type")
    .eq("id", userId)
    .single();

  if (profile?.plan_type === "lifetime") {
    await supabaseAdmin.from("profiles").update({
      stripe_subscription_id: null,
      stripe_subscription_status: null,
    }).eq("id", userId);
    return;
  }

  await supabaseAdmin.from("profiles").update({
    plan: "free",
    plan_type: null,
    plan_tier: null,
    stripe_subscription_status: "canceled",
    plan_expires_at: null,
  }).eq("id", userId);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  await supabaseAdmin.from("profiles").update({
    stripe_subscription_status: "past_due",
  }).eq("id", userId);
}
