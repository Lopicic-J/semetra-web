import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Use service-role key so webhook can bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

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
        // Unhandled event — ignore
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

  // For one-time payments (Lifetime Pro), also try by email
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

  // One-time payment (Lifetime Pro) — no subscription, never expires
  if (session.mode === "payment") {
    await supabaseAdmin.from("profiles").update({
      plan: "pro",
      plan_type: "lifetime",
      stripe_subscription_status: null,
      stripe_customer_id: (session.customer as string) ?? null,
      plan_expires_at: null,
    }).eq("id", userId);
    console.log("[webhook] Lifetime Pro activated for user:", userId);
    return;
  }

  // Subscription-based purchase
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.warn("[webhook] No subscription in session:", session.id);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await supabaseAdmin.from("profiles").update({
    plan: "pro",
    plan_type: "subscription",
    stripe_subscription_id: subscriptionId,
    stripe_subscription_status: subscription.status,
    stripe_price_id: subscription.items.data[0]?.price.id ?? null,
    plan_expires_at: null,
    stripe_customer_id: session.customer as string,
  }).eq("id", userId);
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id
    ?? await getUserIdFromCustomer(sub.customer as string);

  if (!userId) return;

  const isActive = sub.status === "active" || sub.status === "trialing";

  await supabaseAdmin.from("profiles").update({
    plan: isActive ? "pro" : "free",
    stripe_subscription_id: sub.id,
    stripe_subscription_status: sub.status,
    stripe_price_id: sub.items.data[0]?.price.id ?? null,
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
    // Just clean up subscription fields, keep Pro
    await supabaseAdmin.from("profiles").update({
      stripe_subscription_id: null,
      stripe_subscription_status: null,
    }).eq("id", userId);
    return;
  }

  await supabaseAdmin.from("profiles").update({
    plan: "free",
    plan_type: null,
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
