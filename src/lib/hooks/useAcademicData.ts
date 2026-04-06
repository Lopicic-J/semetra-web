"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  GradeScale,
  GradeBand,
  PassPolicy,
  RetakePolicy,
  RoundingPolicy,
  CountrySystem,
  AssessmentComponent,
  Enrollment,
  Attempt,
  ComponentResult,
  CreditAward,
  Recognition,
  Institution,
  Program,
  ProgramRequirementGroup,
  AcademicTerm,
  ClassificationScheme,
  GPAScheme,
  CreditScheme,
} from "@/lib/academic";

// ─────────────────────────────────────────────────────────────────────────────
// Reference data hook — loads once, shared across components
// ─────────────────────────────────────────────────────────────────────────────

interface AcademicReferenceData {
  gradeScales: GradeScale[];
  gradeBands: GradeBand[];
  passPolicies: PassPolicy[];
  retakePolicies: RetakePolicy[];
  roundingPolicies: RoundingPolicy[];
  countrySystems: CountrySystem[];
  creditSchemes: CreditScheme[];
  classificationSchemes: ClassificationScheme[];
  gpaSchemes: GPAScheme[];
  loading: boolean;
}

let cachedRef: Omit<AcademicReferenceData, "loading"> | null = null;

export function useAcademicReference(): AcademicReferenceData {
  const [data, setData] = useState<Omit<AcademicReferenceData, "loading">>(
    cachedRef ?? {
      gradeScales: [],
      gradeBands: [],
      passPolicies: [],
      retakePolicies: [],
      roundingPolicies: [],
      countrySystems: [],
      creditSchemes: [],
      classificationSchemes: [],
      gpaSchemes: [],
    }
  );
  const [loading, setLoading] = useState(!cachedRef);
  const supabase = createClient();

  useEffect(() => {
    if (cachedRef) return;
    let cancelled = false;

    (async () => {
      const [
        { data: scales },
        { data: bands },
        { data: pass },
        { data: retake },
        { data: rounding },
        { data: countries },
        { data: credits },
        { data: classification },
        { data: gpa },
      ] = await Promise.all([
        supabase.from("grade_scales").select("*").order("code"),
        supabase.from("grade_bands").select("*").order("sort_order"),
        supabase.from("pass_policies").select("*"),
        supabase.from("retake_policies").select("*"),
        supabase.from("rounding_policies").select("*"),
        supabase.from("country_systems").select("*"),
        supabase.from("credit_schemes").select("*"),
        supabase.from("classification_schemes").select("*"),
        supabase.from("gpa_schemes").select("*"),
      ]);

      if (cancelled) return;

      const result = {
        gradeScales: (scales ?? []) as unknown as GradeScale[],
        gradeBands: (bands ?? []) as unknown as GradeBand[],
        passPolicies: (pass ?? []) as unknown as PassPolicy[],
        retakePolicies: (retake ?? []) as unknown as RetakePolicy[],
        roundingPolicies: (rounding ?? []) as unknown as RoundingPolicy[],
        countrySystems: (countries ?? []) as unknown as CountrySystem[],
        creditSchemes: (credits ?? []) as unknown as CreditScheme[],
        classificationSchemes: (classification ?? []) as unknown as ClassificationScheme[],
        gpaSchemes: (gpa ?? []) as unknown as GPAScheme[],
      };
      cachedRef = result;
      setData(result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [supabase]);

  return { ...data, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollments hook — user's module enrollments with attempts
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentWithAttempts extends Record<string, unknown> {
  id: string;
  user_id: string;
  module_id: string;
  program_id: string | null;
  academic_year: string | null;
  term_id: string | null;
  status: string;
  attempts_used: number;
  current_final_grade: number | null;
  current_grade_label: string | null;
  current_passed: boolean | null;
  credits_awarded: number;
  local_grade_value: number | null;
  local_grade_label: string | null;
  normalized_score_0_100: number | null;
  normalization_method: string | null;
  conversion_confidence: number | null;
  attempts?: AttemptRow[];
}

interface AttemptRow {
  id: string;
  enrollment_id: string;
  attempt_number: number;
  date_started: string | null;
  date_completed: string | null;
  status: string;
  final_grade_value: number | null;
  final_grade_label: string | null;
  passed: boolean | null;
  credits_awarded: number;
  counts_toward_record: boolean;
  notes: string | null;
  component_results?: ComponentResultRow[];
}

interface ComponentResultRow {
  id: string;
  attempt_id: string;
  component_id: string;
  raw_score: number | null;
  grade_value: number | null;
  grade_label: string | null;
  passed: boolean | null;
  weight_applied: number | null;
  grader_notes: string | null;
}

export function useEnrollments() {
  const [enrollments, setEnrollments] = useState<EnrollmentWithAttempts[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enrollments")
      .select("*, attempts(*, component_results(*))")
      .order("created_at", { ascending: false });
    setEnrollments((data ?? []) as unknown as EnrollmentWithAttempts[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("enrollments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, fetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "attempts" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, supabase]);

  return { enrollments, loading, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment components for a module
// ─────────────────────────────────────────────────────────────────────────────

export function useAssessmentComponents(moduleId: string | null) {
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!moduleId) {
      setComponents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("assessment_components")
        .select("*")
        .eq("module_id", moduleId)
        .order("sequence_order");
      if (!cancelled) {
        setComponents((data ?? []) as unknown as AssessmentComponent[]);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [moduleId, supabase]);

  return { components, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Programs & Institutions
// ─────────────────────────────────────────────────────────────────────────────

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("programs").select("*");
    setPrograms((data ?? []) as unknown as Program[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  return { programs, loading, refetch: fetch };
}

export function useInstitutions() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("institutions").select("*").order("name");
      if (!cancelled) {
        setInstitutions((data ?? []) as unknown as Institution[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  return { institutions, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Academic Terms
// ─────────────────────────────────────────────────────────────────────────────

export function useAcademicTerms() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("academic_terms")
      .select("*")
      .order("academic_year_label")
      .order("term_number");
    setTerms((data ?? []) as unknown as AcademicTerm[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  return { terms, loading, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit Awards
// ─────────────────────────────────────────────────────────────────────────────

export function useCreditAwards() {
  const [awards, setAwards] = useState<CreditAward[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("credit_awards")
      .select("*")
      .order("awarded_at", { ascending: false });
    setAwards((data ?? []) as unknown as CreditAward[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  return { awards, loading, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recognitions (Transfer credits)
// ─────────────────────────────────────────────────────────────────────────────

export function useRecognitions() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recognitions")
      .select("*")
      .order("created_at", { ascending: false });
    setRecognitions((data ?? []) as unknown as Recognition[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  return { recognitions, loading, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement groups (for progress tracking)
// ─────────────────────────────────────────────────────────────────────────────

export function useRequirementGroups(programId?: string | null) {
  const [groups, setGroups] = useState<ProgramRequirementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("program_requirement_groups")
        .select("*")
        .order("sort_order");
      if (programId) {
        query = query.eq("program_id", programId);
      }
      const { data } = await query;
      if (!cancelled) {
        setGroups((data ?? []) as unknown as ProgramRequirementGroup[]);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  return { requirementGroups: groups, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Attempts (standalone — decoupled from enrollments)
// ─────────────────────────────────────────────────────────────────────────────

export function useAttempts() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("attempts")
        .select("*")
        .order("attempt_number", { ascending: false });
      if (!cancelled) {
        setAttempts((data ?? []) as unknown as Attempt[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { attempts, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Academic Modules (from academic_modules table)
// ─────────────────────────────────────────────────────────────────────────────

interface AcademicModuleRow {
  id: string;
  program_id: string | null;
  requirement_group_id: string | null;
  code: string | null;
  name: string;
  credits: number | null;
  semester: string | null;
  description: string | null;
  delivery_mode: string | null;
  language: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function useAcademicModules(programId?: string | null) {
  const [modules, setModules] = useState<AcademicModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from("academic_modules").select("*").order("name");
      if (programId) {
        query = query.eq("program_id", programId);
      }
      const { data } = await query;
      if (!cancelled) {
        setModules((data ?? []) as unknown as AcademicModuleRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  return { modules, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Prerequisites
// ─────────────────────────────────────────────────────────────────────────────

export function usePrerequisites(moduleId?: string | null) {
  const [prerequisites, setPrerequisites] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from("module_prerequisites").select("*");
      if (moduleId) {
        query = query.eq("module_id", moduleId);
      }
      const { data } = await query;
      if (!cancelled) {
        setPrerequisites(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  return { prerequisites, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined hook — loads ALL academic page data in a single Promise.all
// This avoids >8 parallel auth-token checks that cause GoTrue lock timeouts
// ─────────────────────────────────────────────────────────────────────────────

interface AcademicPageData {
  programs: Program[];
  requirementGroups: ProgramRequirementGroup[];
  enrollments: Enrollment[];
  attempts: Attempt[];
  creditAwards: CreditAward[];
  academicModules: unknown[];
  prerequisites: unknown[];
  recognitions: Recognition[];
  institutions: Institution[];
  academicTerms: AcademicTerm[];
  loading: boolean;
}

let cachedPageData: Omit<AcademicPageData, "loading"> | null = null;

export function useAcademicPageData(): AcademicPageData {
  const [data, setData] = useState<Omit<AcademicPageData, "loading">>(
    cachedPageData ?? {
      programs: [],
      requirementGroups: [],
      enrollments: [],
      attempts: [],
      creditAwards: [],
      academicModules: [],
      prerequisites: [],
      recognitions: [],
      institutions: [],
      academicTerms: [],
    }
  );
  const [loading, setLoading] = useState(!cachedPageData);
  const supabase = createClient();

  useEffect(() => {
    if (cachedPageData) return;
    let cancelled = false;

    (async () => {
      const [
        { data: progs },
        { data: reqGroups },
        { data: enrs },
        { data: atts },
        { data: awards },
        { data: acMods },
        { data: prereqs },
        { data: recs },
        { data: insts },
        { data: terms },
      ] = await Promise.all([
        supabase.from("programs").select("*"),
        supabase.from("program_requirement_groups").select("*").order("sort_order"),
        supabase.from("enrollments").select("*, attempts(*, component_results(*))").order("created_at", { ascending: false }),
        supabase.from("attempts").select("*").order("attempt_number", { ascending: false }),
        supabase.from("credit_awards").select("*").order("awarded_at", { ascending: false }),
        supabase.from("academic_modules").select("*").order("name"),
        supabase.from("module_prerequisites").select("*"),
        supabase.from("recognitions").select("*").order("created_at", { ascending: false }),
        supabase.from("institutions").select("*").order("name"),
        supabase.from("academic_terms").select("*").order("academic_year_label").order("term_number"),
      ]);

      if (cancelled) return;

      const result = {
        programs: (progs ?? []) as unknown as Program[],
        requirementGroups: (reqGroups ?? []) as unknown as ProgramRequirementGroup[],
        enrollments: (enrs ?? []) as unknown as Enrollment[],
        attempts: (atts ?? []) as unknown as Attempt[],
        creditAwards: (awards ?? []) as unknown as CreditAward[],
        academicModules: acMods ?? [],
        prerequisites: prereqs ?? [],
        recognitions: (recs ?? []) as unknown as Recognition[],
        institutions: (insts ?? []) as unknown as Institution[],
        academicTerms: (terms ?? []) as unknown as AcademicTerm[],
      };
      cachedPageData = result;
      setData(result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...data, loading };
}
