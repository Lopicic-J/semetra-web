/**
 * Server-side AI usage tracking with weighted credits.
 *
 * Flow (v3 — dual tier + weights):
 * 1. Free users → limited client-side (3/month via localStorage), no server check
 * 2. Pro Basic (subscription) → 10/month pool + optional add-on
 * 3. Pro Full (subscription) → 100/month pool + optional add-on
 * 4. Lifetime Basic → 0 pool, only add-on credits (monthly, expire!)
 * 5. Lifetime Full → 20/month pool + optional add-on
 *
 * Gewichtung: Nicht jeder Request kostet 1 Credit.
 * chat_short=1, chat_explain=2, math_solve=1, flashcards=3, notes=3, pdf=5
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { AI_POOL } from "@/lib/gates";
import type { PlanTier } from "@/lib/gates";
import type { AiActionType } from "@/lib/ai-weights";
import { AI_WEIGHTS } from "@/lib/ai-weights";

const log = logger("ai:usage");

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface AiUsageResult {
  allowed: boolean;
  used: number;
  remaining: number;
  cost: number;
  source: "pool" | "addon" | "none" | "free";
  monthlyPool: number;
  addonCredits: number;
}

function determineMonthlyPool(
  hasActiveSubscription: boolean,
  isLifetime: boolean,
  planTier: PlanTier | null,
): number {
  if (hasActiveSubscription) {
    return planTier === "full"
      ? AI_POOL.proFullMonthlyPool
      : AI_POOL.proBasicMonthlyPool;
  }
  if (isLifetime) {
    return planTier === "full"
      ? AI_POOL.lifetimeFullMonthlyPool
      : AI_POOL.lifetimeBasicMonthlyPool;
  }
  return 0;
}

/**
 * Check and (if allowed) increment AI usage for a user.
 * Now accepts an action type to determine credit cost.
 */
export async function checkAndIncrementAiUsage(
  userId: string,
  action: AiActionType = "chat_short",
): Promise<AiUsageResult> {
  const weight = AI_WEIGHTS[action] ?? 1;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_type, plan_tier, stripe_subscription_status, plan_expires_at, ai_credits")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: false, used: 0, remaining: 0, cost: weight, source: "none", monthlyPool: 0, addonCredits: 0 };
  }

  const isPro = profile.plan === "pro" && (
    profile.plan_type === "lifetime" ||
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing" ||
    (profile.plan_expires_at != null && new Date(profile.plan_expires_at) > new Date())
  );
  const isLifetime = profile.plan_type === "lifetime";
  const hasActiveSubscription = profile.stripe_subscription_status === "active" || profile.stripe_subscription_status === "trialing";
  const planTier = (profile.plan_tier as PlanTier | null) ?? "basic";

  // Free users: no server-side tracking
  if (!isPro && !isLifetime) {
    return { allowed: true, used: 0, remaining: 0, cost: weight, source: "free", monthlyPool: 0, addonCredits: 0 };
  }

  const monthlyPool = determineMonthlyPool(hasActiveSubscription, isLifetime, planTier);

  // Call atomic Supabase function with weight
  const { data, error } = await supabase.rpc("check_and_increment_ai", {
    p_user_id: userId,
    p_month: currentMonth(),
    p_monthly_pool: monthlyPool,
    p_weight: weight,
  });

  if (error) {
    log.error("AI usage check failed", error);
    return { allowed: true, used: 0, remaining: 0, cost: weight, source: "pool", monthlyPool, addonCredits: 0 };
  }

  return {
    allowed: data.allowed,
    used: data.used,
    remaining: data.remaining,
    cost: weight,
    source: data.source,
    monthlyPool: data.monthly_pool,
    addonCredits: data.addon_credits,
  };
}

/**
 * Get current AI usage stats (read-only).
 */
export async function getAiUsageStats(userId: string): Promise<{
  used: number;
  monthlyPool: number;
  addonCredits: number;
  isLifetime: boolean;
  planTier: string | null;
}> {
  const supabase = await createClient();

  const [profileRes, usageRes] = await Promise.all([
    supabase.from("profiles")
      .select("plan, plan_type, plan_tier, stripe_subscription_status, ai_credits")
      .eq("id", userId).single(),
    supabase.from("ai_usage")
      .select("used, addon_credits")
      .eq("user_id", userId).eq("month", currentMonth()).single(),
  ]);

  const profile = profileRes.data;
  const hasActiveSubscription = profile?.stripe_subscription_status === "active" || profile?.stripe_subscription_status === "trialing";
  const isLifetime = profile?.plan_type === "lifetime";
  const planTier = (profile?.plan_tier as PlanTier | null) ?? "basic";

  const monthlyPool = determineMonthlyPool(hasActiveSubscription, isLifetime, planTier);

  return {
    used: usageRes.data?.used ?? 0,
    monthlyPool,
    addonCredits: usageRes.data?.addon_credits ?? 0,
    isLifetime: !!isLifetime,
    planTier: profile?.plan_tier ?? null,
  };
}
