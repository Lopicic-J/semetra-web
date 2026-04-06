"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "./useProfile";
import { createClient } from "@/lib/supabase/client";

/**
 * Guard hook for Builder detail pages.
 * - Redirects non-builder users (student, non_student) to /dashboard
 * - For institution users: verifies they manage the given institutionId
 * - For admins: always allowed
 *
 * Returns { authorized, loading } — render nothing until authorized.
 */
export function useBuilderGuard(institutionId?: string | null) {
  const router = useRouter();
  const { profile, loading: profileLoading, canAccessBuilder, isAdmin, isInstitution } = useProfile();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading) return;

    // Students / Non-Students have no access
    if (!canAccessBuilder) {
      router.replace("/dashboard");
      return;
    }

    // Admin can access everything
    if (isAdmin) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    // Institution user: verify they manage this institution
    if (isInstitution && institutionId) {
      const supabase = createClient();
      supabase
        .from("institution_admins")
        .select("institution_id")
        .eq("user_id", profile!.id)
        .then(({ data }) => {
          const managedIds = new Set((data || []).map(a => a.institution_id));
          if (managedIds.has(institutionId)) {
            setAuthorized(true);
          } else {
            router.replace("/builder");
          }
          setLoading(false);
        });
      return;
    }

    // Institution user without institutionId (e.g. creating new) — allow if canAccessBuilder
    if (isInstitution && !institutionId) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    // Fallback: not authorized
    router.replace("/builder");
  }, [profileLoading, canAccessBuilder, isAdmin, isInstitution, institutionId, profile, router]);

  return { authorized, loading: loading || profileLoading };
}
