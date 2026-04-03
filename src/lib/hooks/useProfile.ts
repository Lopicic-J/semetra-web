"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CountryCode } from "@/lib/grading-systems";

export type Plan = "free" | "pro";
export type PlanType = "free" | "subscription" | "lifetime";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  plan_type: PlanType | null;
  country: CountryCode | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  plan_expires_at: string | null;
  study_start: string | null;
  study_end: string | null;
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

  // Pro status: lifetime (never expires), active subscription, or within expiry window
  const isPro = profile?.plan === "pro" && (
    profile.plan_type === "lifetime" ||
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing" ||
    (profile.plan_expires_at != null && new Date(profile.plan_expires_at) > new Date())
  );

  const isLifetime = profile?.plan_type === "lifetime";

  return { profile, loading, isPro: !!isPro, isLifetime: !!isLifetime, refetch: load };
}
