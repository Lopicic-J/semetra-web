"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CountryCode } from "@/lib/grading-systems";
import type { PlanTier } from "@/lib/gates";

export type Plan = "free" | "pro";
export type PlanType = "free" | "subscription" | "lifetime";
export type UserRole = "admin" | "institution" | "student" | "non_student";
export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

/** @deprecated Use UserRole instead */
export type BuilderRole = UserRole;

// ── Plan Cache ──────────────────────────────────────────────────────────────
// Caches plan-related fields in localStorage so the badge renders instantly
// on refresh. The cache stores `plan_expires_at` so expired plans are NOT
// restored from cache — preventing a "forever Pro" loop.
const PLAN_CACHE_KEY = "semetra_plan_cache";

interface PlanCache {
  plan: Plan;
  plan_type: PlanType | null;
  plan_tier: PlanTier | null;
  stripe_subscription_status: string | null;
  plan_expires_at: string | null;
  cached_at: string; // ISO timestamp — stale after 24h
}

function readPlanCache(): PlanCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const c: PlanCache = JSON.parse(raw);

    // Stale guard: discard cache older than 24 hours
    if (Date.now() - new Date(c.cached_at).getTime() > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PLAN_CACHE_KEY);
      return null;
    }

    // Expiry guard: if plan_expires_at is set and in the past → not Pro anymore
    if (c.plan === "pro" && c.plan_type !== "lifetime") {
      const hasActiveSubscription =
        c.stripe_subscription_status === "active" ||
        c.stripe_subscription_status === "trialing";
      const withinExpiry =
        c.plan_expires_at != null && new Date(c.plan_expires_at) > new Date();

      if (!hasActiveSubscription && !withinExpiry) {
        // Plan expired — don't serve stale Pro from cache
        localStorage.removeItem(PLAN_CACHE_KEY);
        return null;
      }
    }

    return c;
  } catch {
    return null;
  }
}

function writePlanCache(p: {
  plan: Plan;
  plan_type: PlanType | null;
  plan_tier: PlanTier | null;
  stripe_subscription_status: string | null;
  plan_expires_at: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    const c: PlanCache = { ...p, cached_at: new Date().toISOString() };
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(c));
  } catch { /* quota exceeded — ignore */ }
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  plan_type: PlanType | null;
  plan_tier: PlanTier | null;       // "basic" | "full"
  country: CountryCode | null;
  university: string | null;
  study_program: string | null;
  semester: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  plan_expires_at: string | null;
  study_start: string | null;
  study_end: string | null;
  ai_credits: number;               // Legacy add-on credits
  language: string | null;
  // Academic Engine fields (Migration 041)
  institution_id: string | null;
  active_program_id: string | null;
  current_semester: number | null;
  study_mode: "full_time" | "part_time";
  existing_ects: number;
  // User Role (Migration 058 — replaces builder_role)
  user_role: UserRole;
  // Verification (Migration 058)
  verification_status: VerificationStatus;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  verification_note: string | null;
  verified_email_domain: string | null;
  // Module source tracking (Migration 056)
  institution_modules_loaded: boolean;
  // Onboarding (Migration 075)
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  // Activity tracking
  last_seen_at: string | null;
}

export function useProfile() {
  const supabase = createClient();

  // Hydrate from cache so the very first render already has the correct plan
  const [cachedPlan] = useState<PlanCache | null>(() => readPlanCache());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // If profile doesn't exist yet (first login before trigger fires), create it
    let finalProfile: Profile | null = null;
    if (!data) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: user.id, email: user.email, plan: "free" })
        .select()
        .single();
      finalProfile = created ?? null;
    } else {
      finalProfile = data as Profile;
    }

    setProfile(finalProfile);
    setLoading(false);

    // Update cache with fresh server data
    if (finalProfile) {
      writePlanCache({
        plan: finalProfile.plan,
        plan_type: finalProfile.plan_type,
        plan_tier: finalProfile.plan_tier,
        stripe_subscription_status: finalProfile.stripe_subscription_status,
        plan_expires_at: finalProfile.plan_expires_at,
      });
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Heartbeat: update last_seen_at on visibility change (max 1x per 5 min) ──
  useEffect(() => {
    if (!profile?.id) return;
    let lastPing = 0;
    const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const ping = () => {
      const now = Date.now();
      if (now - lastPing < MIN_INTERVAL) return;
      lastPing = now;
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id).then();
    };

    ping(); // immediate on mount

    const handleVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [profile?.id, supabase]);

  // Pro status: lifetime (never expires), active subscription, or within expiry window
  const isPro = profile?.plan === "pro" && (
    profile.plan_type === "lifetime" ||
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing" ||
    (profile.plan_expires_at != null && new Date(profile.plan_expires_at) > new Date())
  );

  // While loading, use cached plan status (already validated against expiry in readPlanCache)
  const cachedIsPro = cachedPlan?.plan === "pro";

  const isLifetime = profile?.plan_type === "lifetime" || (loading && cachedPlan?.plan_type === "lifetime");
  const planTier: PlanTier | null = (profile?.plan_tier as PlanTier | null) ?? (loading ? cachedPlan?.plan_tier ?? null : null);
  const aiCredits = profile?.ai_credits ?? 0;
  const userRole: UserRole = (profile?.user_role as UserRole) ?? "non_student";
  const verificationStatus: VerificationStatus = (profile?.verification_status as VerificationStatus) ?? "none";
  const isAdmin = userRole === "admin";
  const isInstitution = userRole === "institution";
  const isStudent = userRole === "student";
  const isNonStudent = userRole === "non_student";
  const isVerified = verificationStatus === "verified" || userRole === "non_student" || userRole === "admin";
  const canAccessBuilder = isAdmin || (isInstitution && isVerified);

  // Deprecated aliases for backward compatibility
  const builderRole = userRole;
  const isPlatformAdmin = isAdmin;
  const isInstitutionAdmin = isInstitution;

  return {
    profile,
    loading,
    isPro: !!(loading ? cachedIsPro : isPro),
    isLifetime: !!isLifetime,
    planTier,
    aiCredits,
    // New role system
    userRole,
    verificationStatus,
    isAdmin,
    isInstitution,
    isStudent,
    isNonStudent,
    isVerified,
    canAccessBuilder,
    // Deprecated aliases (backward compatibility)
    builderRole,
    isPlatformAdmin,
    isInstitutionAdmin,
    refetch: load,
  };
}
