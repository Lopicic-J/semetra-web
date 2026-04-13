"use client";
import { useEffect, useState, useMemo } from "react";
import { useStudentProgram } from "@/lib/hooks/useStudentProgram";
import { useTranslation } from "@/lib/i18n";
import {
  GraduationCap,
  Building2,
  BookOpen,
  TrendingUp,
  Calendar,
  Award,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface EngineStats {
  enrollmentCount: number;
  passedCount: number;
  totalCredits: number;
  averageNormalized: number | null;
  completionPct: number;
}

/**
 * Program enrollment banner for the dashboard.
 * Shows: institution, program, semester, engine-derived GPA, completion %.
 * Only renders if user is enrolled in a structured program.
 */
export default function StudyStatusBanner() {
  const { t } = useTranslation();
  const { active, isEnrolled, loading } = useStudentProgram();
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch engine stats when enrolled
  useEffect(() => {
    if (!isEnrolled) return;
    setStatsLoading(true);

    fetch("/api/academic/enrollment/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [isEnrolled]);

  if (loading) return null;
  if (!isEnrolled || !active) return null;

  const program = active.program;
  const institution = active.institution;
  const semester = active.current_semester || 1;
  const requiredCredits = program?.required_total_credits || 180;

  // Graduation estimate: simple (required_credits / credits_per_semester) based estimate
  const creditsEarned = stats?.totalCredits || 0;
  const completionPct = requiredCredits > 0 ? Math.min(100, Math.round((creditsEarned / requiredCredits) * 100)) : 0;
  const creditsPerSemester = semester > 0 ? creditsEarned / semester : 30;
  const remainingCredits = Math.max(0, requiredCredits - creditsEarned);
  const remainingSemesters = creditsPerSemester > 0 ? Math.ceil(remainingCredits / creditsPerSemester) : null;

  const degreeLabelMap: Record<string, string> = {
    bachelor: "Bachelor",
    master: "Master",
    phd: "PhD",
    diploma: "Diplom",
    short_cycle: "Kurzstudium",
  };

  return (
    <div className="card bg-gradient-to-r from-brand-50/80 via-white to-brand-50/40 border-brand-100 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
        {/* Left: Program info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-brand-100 text-brand-600 shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-surface-900 text-base">
                {program?.name || "Studiengang"}
              </h2>
              {program?.degree_level && (
                <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                  {degreeLabelMap[program.degree_level] || program.degree_level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
              {institution && (
                <span className="flex items-center gap-1 max-w-[180px] sm:max-w-none">
                  <Building2 size={11} className="shrink-0" />
                  <span className="truncate">{institution.name}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <BookOpen size={11} />
                {semester}. Semester
              </span>
              {remainingSemesters !== null && remainingSemesters > 0 && creditsEarned > 0 && (
                <span className="flex items-center gap-1 text-brand-600">
                  <Calendar size={11} />
                  ~{remainingSemesters} Semester verbleibend
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick stats */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {statsLoading ? (
            <Loader2 size={16} className="animate-spin text-surface-300" />
          ) : stats ? (
            <>
              {/* Engine GPA (normalized) */}
              {stats.averageNormalized !== null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-surface-900">
                    {stats.averageNormalized.toFixed(1)}
                    <span className="text-[10px] text-surface-400 ml-0.5">/100</span>
                  </p>
                  <p className="text-[9px] text-surface-400 uppercase tracking-wider">Engine Score</p>
                </div>
              )}
              {/* Passed modules */}
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{stats.passedCount}</p>
                <p className="text-[9px] text-surface-400 uppercase tracking-wider">Bestanden</p>
              </div>
            </>
          ) : null}

          {/* Completion ring */}
          <div className="relative w-11 h-11 sm:w-14 sm:h-14 shrink-0">
            <svg className="w-11 h-11 sm:w-14 sm:h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-100" />
              <circle
                cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                className="text-brand-500"
                strokeDasharray={`${(completionPct / 100) * 150.8} 150.8`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-surface-900">{completionPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ECTS Progress bar */}
      <div className="mt-3 pt-3 border-t border-brand-100/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">
            Studienfortschritt
          </span>
          <span className="text-xs text-surface-600 font-medium">
            {creditsEarned} / {requiredCredits} ECTS
          </span>
        </div>
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
