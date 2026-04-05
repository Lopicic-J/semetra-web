"use client";
import { useEffect, useState, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface InstitutionRef {
  id: string;
  name: string;
  country_code: string;
  institution_type?: string;
}

export interface ProgramRef {
  id: string;
  name: string;
  degree_level: string;
  required_total_credits?: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  program_id: string;
  institution_id: string | null;
  status: string;
  enrollment_date: string | null;
  expected_graduation: string | null;
  current_semester: number | null;
  created_at: string;
  updated_at: string;
  program: ProgramRef | null;
  institution: InstitutionRef | null;
}

export interface EnrollmentProfile {
  institution_id: string | null;
  active_program_id: string | null;
  current_semester: number | null;
  university: string | null;
  study_program: string | null;
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useStudentProgram() {
  const [active, setActive] = useState<Enrollment | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentProfile, setEnrollmentProfile] =
    useState<EnrollmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Fetch current enrollment state ─────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/academic/enrollment");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setActive(data.active || null);
      setEnrollments(data.enrollments || []);
      setEnrollmentProfile(data.profile || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enrollment-Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Enroll in a program ────────────────────────────────────────────── */
  const enroll = useCallback(
    async (
      institution_id: string,
      program_id: string,
      current_semester?: number
    ) => {
      setError(null);
      try {
        const res = await fetch("/api/academic/enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institution_id, program_id, current_semester }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        // Refetch all enrollment data to stay in sync
        await load();
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Einschreibung fehlgeschlagen");
        return false;
      }
    },
    [load]
  );

  /* ── Update enrollment (e.g. semester change) ───────────────────────── */
  const update = useCallback(
    async (updates: {
      current_semester?: number;
      program_id?: string;
      institution_id?: string;
    }) => {
      setError(null);
      try {
        const res = await fetch("/api/academic/enrollment", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await load();
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Update fehlgeschlagen");
        return false;
      }
    },
    [load]
  );

  /* ── Derived state ──────────────────────────────────────────────────── */
  const isEnrolled = !!active;
  const programName = active?.program?.name || enrollmentProfile?.study_program || null;
  const institutionName =
    active?.institution?.name || enrollmentProfile?.university || null;

  return {
    active,
    enrollments,
    enrollmentProfile,
    loading,
    error,
    isEnrolled,
    programName,
    institutionName,
    enroll,
    update,
    refetch: load,
  };
}
