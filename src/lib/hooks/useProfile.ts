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
  // Activity tracking
  last_seen_at: string | null;
}

export function useProfile() {
  const supabase = createClient();
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
    if (!data) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: user.id, email: user.email, plan: "free" })
        .select()
        .single();
      setProfile(created ?? null);
    } else {
      setProfile(data as Profile);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Heartbeat: update last_seen_at on load + every 5 min ──
  useEffect(() => {
    if (!profile?.id) return;
    const ping = () => {
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id).then();
    };
    ping(); // immediate
    const iv = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [profile?.id, supabase]);

  // Pro status: lifetime (never expires), active subscription, or within expiry window
  const isPro = profile?.plan === "pro" && (
    profile.plan_type === "lifetime" ||
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing" ||
    (profile.plan_expires_at != null && new Date(profile.plan_expires_at) > new Date())
  );

  const isLifetime = profile?.plan_type === "lifetime";
  const planTier: PlanTier | null = (profile?.plan_tier as PlanTier | null) ?? null;
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
    isPro: !!isPro,
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
