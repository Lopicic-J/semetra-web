"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useGrades } from "@/lib/hooks/useGrades";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { createClient } from "@/lib/supabase/client";
import { formatDate, gradeAvg, ectsWeightedAvg } from "@/lib/utils";
import { getGradeColor, getGradeLabelText, formatGrade } from "@/lib/grading-systems";
import type { GradingSystem } from "@/lib/grading-systems";
import { FREE_LIMITS } from "@/lib/gates";
import { UpgradeModal, ProGate } from "@/components/ui/ProGate";
import { Plus, X, Trash2, Pencil, BarChart2, TrendingUp, AlertTriangle, Award, Target, GraduationCap, RotateCcw } from "lucide-react";
import { GradeAnalytics } from "@/components/grades/GradeAnalytics";
import ComponentGradePanel from "@/components/grades/ComponentGradePanel";
import type { Grade, Module, CalendarEvent } from "@/types/database";

type Exam = CalendarEvent & { daysLeft?: number };

function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

/** Best grade per module – for display / ranking.
 *  For "higher_better" systems (CH, FR, IT…) this is Math.max,
 *  for "lower_better" systems (DE, AT) this is Math.min. */
function bestGradeForModule(moduleId: string, grades: Grade[], direction: "higher_better" | "lower_better" = "higher_better"): number | null {
  const mg = grades.filter(g => g.module_id === moduleId && g.grade != null);
  if (mg.length === 0) return null;
  return direction === "higher_better"
    ? Math.max(...mg.map(g => g.grade!))
    : Math.min(...mg.map(g => g.grade!));
}

/** Weighted average of all grades in a module — this determines if ECTS are earned.
 *  ECTS are only credited when the module average ≥ passing grade (e.g. 4.0 for CH). */
function moduleWeightedAvg(moduleId: string, grades: Grade[]): number | null {
  const mg = grades.filter(g => g.module_id === moduleId && g.grade != null);
  if (mg.length === 0) return null;
  const totalWeight = mg.reduce((s, g) => s + (g.weight ?? 1), 0);
  if (totalWeight === 0) return null;
  return mg.reduce((s, g) => s + g.grade! * (g.weight ?? 1), 0) / totalWeight;
}

/** Calculate what grade is needed on the next exam to reach a target average for a module */
function neededGradeForTarget(moduleId: string, grades: Grade[], target: number, nextWeight: number = 1): number | null {
  const mg = grades.filter(g => g.module_id === moduleId && g.grade != null);
  if (mg.length === 0) return target; // no grades yet → need exactly target
  const currentSum = mg.reduce((s, g) => s + g.grade! * (g.weight ?? 1), 0);
  const currentWeight = mg.reduce((s, g) => s + (g.weight ?? 1), 0);
  // target = (currentSum + needed * nextWeight) / (currentWeight + nextWeight)
  const needed = (target * (currentWeight + nextWeight) - currentSum) / nextWeight;
  return Math.round(needed * 100) / 100;
}

/** Safe grade average that handles null grades */
function safeGradeAvg(grades: Grade[]): number {
  const withGrade = grades.filter(g => g.grade != null);
  return gradeAvg(withGrade as (Grade & { grade: number })[]);
}

export default function GradesTabContent() {
  const { t } = useTranslation();
  const { grades, loading, refetch } = useGrades();
  const { modules } = useModules();
  const { isPro, profile } = useProfile();
  const gs = useGradingSystem();
  const [exams, setExams] = useState<Exam[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterExam, setFilterExam] = useState<string>("all");
  const [showUpgrade, setShowUpgrade] = useState(false);
  // Engine enrollments per module (for component grade panel)
  const [enrollmentMap, setEnrollmentMap] = useState<Record<string, string>>({});
  const supabase = createClient();

  // Load enrollment IDs for each module (for component grade panel)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("enrollments")
        .select("id, module_id")
        .eq("user_id", user.id);
      if (data) {
        const map: Record<string, string> = {};
        for (const e of data) if (e.module_id) map[e.module_id] = e.id;
        setEnrollmentMap(map);
      }
    })();
  }, [supabase, grades]); // re-run when grades change (bridge may create new enrollments)

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("event_type", "exam")
      .order("start_dt", { ascending: true });
    const now = new Date();
    setExams((data ?? []).map(e => ({
      ...e,
      daysLeft: Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })));
  }, [supabase]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Apply filters
  let filtered = grades;
  if (filterModule !== "all") filtered = filtered.filter(g => g.module_id === filterModule);
  if (filterExam !== "all") filtered = filtered.filter(g => g.exam_id === filterExam);

  const avg = safeGradeAvg(filtered);

  // ECTS calculations — based on module AVERAGE (not best single grade)
  // ECTS are credited when the weighted average of all exams ≥ passing grade
  const totalEcts = modules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const earnedEcts = modules.reduce((s, m) => {
    const avg = moduleWeightedAvg(m.id, grades);
    if (avg !== null && gs.isPassing(avg)) return s + (m.ects ?? 0);
    return s;
  }, 0);
  // Also count manually entered ECTS from grades
  const manualEcts = grades.reduce((s, g) => s + (g.ects_earned ?? 0), 0);
  const totalEarnedEcts = earnedEcts + manualEcts;

  const failedModules = modules.filter(m => {
    const avg = moduleWeightedAvg(m.id, grades);
    return avg !== null && !gs.isPassing(avg);
  });
  const gradedModules = modules.filter(m => bestGradeForModule(m.id, grades) !== null);
  const ungradedModules = modules.filter(m => bestGradeForModule(m.id, grades) === null);

  // ECTS-weighted average (official Swiss GPA)
  const ectsAvg = (() => {
    const moduleGrades = modules
      .map(m => {
        const best = bestGradeForModule(m.id, grades);
        if (best === null) return null;
        return { grade: best, ects: m.ects ?? 0 };
      })
      .filter((x): x is { grade: number; ects: number } => x !== null && x.ects > 0);
    return ectsWeightedAvg(moduleGrades);
  })();

  // Group by module with ECTS info — pass/fail based on module average
  const byModule = modules.map(m => {
    const mGrades = grades.filter(g => g.module_id === m.id);
    const best = bestGradeForModule(m.id, grades, gs.direction);
    const avg = moduleWeightedAvg(m.id, grades);
    return { module: m, grades: mGrades, bestGrade: best, moduleAvg: avg, passed: avg !== null && gs.isPassing(avg) };
  }).filter(x => x.grades.length > 0);

  // Exams with grades (for filter)
  const gradedExams = exams.filter(e => grades.some(g => g.exam_id === e.id));

  // Exam status overview
  const examStatus = exams.map(e => {
    const examGrades = grades.filter(g => g.exam_id === e.id && g.grade != null);
    if (examGrades.length === 0) return { exam: e, status: "pending" as const };
    const gradeValues = examGrades.map(g => g.grade!);
    const best = gs.direction === "higher_better" ? Math.max(...gradeValues) : Math.min(...gradeValues);
    return { exam: e, status: gs.isPassing(best) ? "passed" as const : "failed" as const, bestGrade: best };
  });

  async function handleDelete(id: string) {
    // Note: No translation key for "delete grade" confirmation, using German
    if (!confirm("Note löschen?")) return;
    await supabase.from("grades").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-surface-500 text-sm">
            {t("grades.subtitle", { count: grades.length, earned: totalEarnedEcts, total: totalEcts, creditLabel: gs.creditLabel })}
          </p>
        </div>
        <button onClick={() => {
          setEditing(null); setShowForm(true);
        }} className="btn-primary gap-2">
          <Plus size={16} /> {t("grades.addGrade")}
        </button>
      </div>

      {/* ECTS Progress Bar */}
      {totalEcts > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-surface-700">{t("grades.ectsProgress", { creditLabel: gs.creditLabel })}</span>
            <span className="text-sm font-bold text-brand-600">{totalEarnedEcts} / {totalEcts} {gs.creditLabel}</span>
          </div>
          <div className="w-full bg-surface-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((totalEarnedEcts / totalEcts) * 100, 100)}%`,
                background: totalEarnedEcts >= totalEcts ? "#059669" : "#7c3aed",
              }}
            />
          </div>
          <p className="text-xs text-surface-400 mt-1.5">
            {Math.round((totalEarnedEcts / totalEcts) * 100)}% {t("grades.percentComplete")}
            {ungradedModules.length > 0 && ` · ${t("grades.modulesRemaining", { count: ungradedModules.length })}`}
          </p>
        </div>
      )}

      {/* ECTS-weighted calculation breakdown */}
      {ectsAvg > 0 && gradedModules.length > 1 && (
        <div className="card bg-brand-50/50 border-brand-200">
          <h3 className="text-xs font-semibold text-brand-700 mb-2 flex items-center gap-1.5">
            <TrendingUp size={12} /> {t("grades.ecsWeightedAverage", { system: gs.name })}
          </h3>
          <div className="text-xs text-surface-600 space-y-1">
            <p className="font-mono text-[11px]">
              = Σ(Modulnote × {gs.creditLabel}) / Σ({gs.creditLabel}) ={" "}
              <span className={`font-bold ${getGradeColor(ectsAvg, gs.country)}`}>{formatGrade(ectsAvg, gs.country)}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {byModule.filter(x => x.bestGrade !== null).map(({ module: m, bestGrade }) => (
                <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgb(var(--card-bg))] border border-surface-200 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color ?? "#6d28d9" }} />
                  {m.name}: {formatGrade(bestGrade!, gs.country)} × {m.ects ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {grades.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="card text-center py-4 col-span-2 sm:col-span-1 sm:row-span-1 relative">
            <TrendingUp size={18} className="mx-auto mb-1.5 text-brand-500" />
            <p className={`text-2xl font-bold ${ectsAvg ? getGradeColor(ectsAvg, gs.country) : "text-surface-300"}`}>
              {ectsAvg ? formatGrade(ectsAvg, gs.country) : "—"}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">{t("grades.averageEcs", { creditLabel: gs.creditLabel })}</p>
            {ectsAvg > 0 && (
              <p className={`text-[10px] mt-0.5 ${getGradeColor(ectsAvg, gs.country)}`}>{getGradeLabelText(ectsAvg, gs.country)}</p>
            )}
          </div>
          <div className="card text-center py-4">
            <BarChart2 size={18} className="mx-auto mb-1.5 text-surface-400" />
            <p className={`text-2xl font-bold ${avg ? getGradeColor(avg, gs.country) : "text-surface-300"}`}>{avg ? formatGrade(avg, gs.country) : "—"}</p>
            <p className="text-xs text-surface-500 mt-0.5">{t("grades.simpleAverage")}</p>
          </div>
          <div className="card text-center py-4">
            <Award size={18} className="mx-auto mb-1.5 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{totalEarnedEcts}</p>
            <p className="text-xs text-surface-500 mt-0.5">{t("grades.ectsEarned", { creditLabel: gs.creditLabel })}</p>
          </div>
          <div className="card text-center py-4">
            <Target size={18} className="mx-auto mb-1.5 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{gradedModules.length}</p>
            <p className="text-xs text-surface-500 mt-0.5">{t("grades.modulesGraded")}</p>
          </div>
          <div className="card text-center py-4">
            <AlertTriangle size={18} className="mx-auto mb-1.5 text-red-400" />
            <p className="text-2xl font-bold text-red-600">{failedModules.length}</p>
            <p className="text-xs text-surface-500 mt-0.5">{t("grades.modulesFailed")}</p>
          </div>
        </div>
      )}

      {/* Exam status overview */}
      {examStatus.filter(e => e.status !== "pending").length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
            <GraduationCap size={14} /> {t("grades.examStatus")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {examStatus.filter(e => e.status !== "pending").map(es => (
              <span key={es.exam.id} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                es.status === "passed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {es.status === "passed" ? "✓" : <RotateCcw size={10} />}
                {es.exam.title}
                {"bestGrade" in es && es.bestGrade != null && (
                  <span className="opacity-70">({es.bestGrade.toFixed(1)})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warning for failed modules */}
      {failedModules.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">{t("grades.failedModules", { count: failedModules.length, plural: failedModules.length > 1 ? "e" : "" })}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {failedModules.map(m => (
              <span key={m.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">
                {m.name} ({bestGradeForModule(m.id, grades)?.toFixed(1)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters: Module + Exam */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-surface-400 font-medium w-14 shrink-0">{t("grades.moduleFilter")}</span>
          <button onClick={() => { setFilterModule("all"); setFilterExam("all"); }}
            className={`badge cursor-pointer text-xs ${filterModule === "all" ? "bg-brand-600 text-white" : "badge-gray hover:bg-surface-200"}`}>
            {t("grades.filterAll")}
          </button>
          {byModule.map(({ module: m, passed }) => (
            <button key={m.id} onClick={() => { setFilterModule(m.id); setFilterExam("all"); }}
              className={`badge cursor-pointer text-xs ${filterModule === m.id ? "text-white" : "badge-gray hover:bg-surface-200"}`}
              style={filterModule === m.id ? { background: m.color ?? "#6d28d9" } : {}}>
              {m.name} {passed ? "✓" : ""}
            </button>
          ))}
        </div>

        {gradedExams.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-surface-400 font-medium w-14 shrink-0">{t("grades.examFilter")}</span>
            <button onClick={() => setFilterExam("all")}
              className={`badge cursor-pointer text-xs ${filterExam === "all" ? "bg-brand-600 text-white" : "badge-gray hover:bg-surface-200"}`}>
              {t("grades.filterAll")}
            </button>
            {gradedExams.map(e => {
              const es = examStatus.find(x => x.exam.id === e.id);
              return (
                <button key={e.id} onClick={() => setFilterExam(e.id)}
                  className={`badge cursor-pointer text-xs flex items-center gap-1 ${filterExam === e.id ? "text-white" : "badge-gray hover:bg-surface-200"}`}
                  style={filterExam === e.id ? { background: e.color ?? "#dc2626" } : {}}>
                  <GraduationCap size={10} /> {e.title}
                  {es?.status === "passed" && " ✓"}
                  {es?.status === "failed" && " ✗"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("grades.noGrades")}</p>
          <p className="text-sm mt-1">{t("grades.noGradesSubtitle", { creditLabel: gs.creditLabel })}</p>
        </div>
      ) : filterModule === "all" && filterExam === "all" ? (
        // Grouped view
        <div className="space-y-4">
          {byModule.map(({ module: m, grades: mGrades, bestGrade, passed }) => {
            const mAvg = safeGradeAvg(mGrades);
            return (
              <div key={m.id} className={`card p-0 overflow-hidden ${!passed && bestGrade !== null ? "ring-1 ring-red-200" : ""}`}>
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-50 border-b border-surface-100">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color ?? "#6d28d9" }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-surface-900">{m.name}</span>
                    {m.semester && <span className="text-xs text-surface-400 ml-2">{displaySemester(m.semester)}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {m.ects && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${passed ? "bg-green-100 text-green-700" : bestGrade !== null ? "bg-red-100 text-red-700" : "bg-surface-100 text-surface-500"}`}>
                        {passed ? `${m.ects} ${gs.creditLabel} ✓` : bestGrade !== null ? `${m.ects} ${gs.creditLabel} ✗` : `${m.ects} ${gs.creditLabel}`}
                      </span>
                    )}
                    {mAvg > 0 && (
                      <div className="text-right">
                        <span className={`text-lg font-bold ${getGradeColor(mAvg, gs.country)}`}>{formatGrade(mAvg, gs.country)}</span>
                        <p className={`text-[10px] ${getGradeColor(mAvg, gs.country)}`}>{getGradeLabelText(mAvg, gs.country)}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-surface-50">
                  {mGrades.map(g => (
                    <GradeRow key={g.id} grade={g} exams={exams} gs={gs} onEdit={e => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
                  ))}
                </div>
                {/* Assessment component grades (from Academic Engine) */}
                <div className="px-4 pb-3">
                  <ComponentGradePanel
                    moduleId={m.id}
                    enrollmentId={enrollmentMap[m.id] || null}
                    countryCode={profile?.country || null}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-surface-50">
          {filtered.map(g => (
            <GradeRow key={g.id} grade={g} exams={exams} gs={gs} onEdit={e => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ─── Notenprognosen & Trendanalyse (Pro Feature) ─── */}
      <ProGate feature="gradeAnalytics" isPro={isPro} mode="overlay">
        <div>
          <h2 className="text-lg font-semibold text-surface-900 mb-3 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-600" />
            {t("grades.analytics") ?? "Notenprognosen & Trendanalyse"}
          </h2>
          <GradeAnalytics grades={grades} modules={modules} gs={gs} />
        </div>
      </ProGate>

      {showForm && (
        <GradeModal
          initial={editing}
          modules={modules}
          exams={exams}
          allGrades={grades}
          gs={gs}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); fetchExams(); }}
        />
      )}

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}

function GradeRow({ grade, exams, gs, onEdit, onDelete }: {
  grade: Grade & { modules?: { name: string; color: string } | null };
  exams: Exam[];
  gs: GradingSystem;
  onEdit: (g: Grade) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const passed = grade.grade != null && gs.isPassing(grade.grade);
  const linkedExam = grade.exam_id ? exams.find(e => e.id === grade.exam_id) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-surface-800">{grade.title}</p>
          {linkedExam && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-brand-50 text-brand-600 shrink-0">
              <GraduationCap size={9} /> {linkedExam.title.length > 20 ? linkedExam.title.slice(0, 20) + "…" : linkedExam.title}
            </span>
          )}
        </div>
        <p className="text-xs text-surface-400">
          {formatDate(grade.date)}
          {grade.weight && grade.weight !== 1 ? ` · Gewicht: ${grade.weight}` : ""}
          {grade.exam_type && ` · ${grade.exam_type}`}
          {grade.ects_earned != null && ` · ${grade.ects_earned} ${gs.creditLabel}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {grade.ects_earned != null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
            {grade.ects_earned} {gs.creditLabel}
          </span>
        )}
        {grade.grade != null && (
          <>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${passed ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
              {passed ? t("grades.passed") : t("grades.notPassed")}
            </span>
            <div className={`text-xl font-bold w-14 text-right ${getGradeColor(grade.grade, gs.country)}`} title={getGradeLabelText(grade.grade, gs.country)}>
              {formatGrade(grade.grade, gs.country)}
            </div>
          </>
        )}
        {grade.grade == null && grade.ects_earned != null && (
          <span className="text-sm font-medium text-blue-600">nur {gs.creditLabel}</span>
        )}
      </div>
      <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(grade)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-brand-600" title="Bearbeiten"><Pencil size={13} /></button>
        <button onClick={() => onDelete(grade.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500" title="Löschen"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function GradeModal({ initial, modules, exams, allGrades, gs, onClose, onSaved }: {
  initial: Grade | null;
  modules: Module[];
  exams: Exam[];
  allGrades: Grade[];
  gs: GradingSystem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    grade: initial?.grade?.toString() ?? "",
    ects_earned: initial?.ects_earned?.toString() ?? "",
    date: initial?.date ? initial.date.split("T")[0] : new Date().toISOString().split("T")[0],
    module_id: initial?.module_id ?? "",
    exam_id: initial?.exam_id ?? "",
    weight: initial?.weight?.toString() ?? "1",
    exam_type: initial?.exam_type ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const gradeNum = form.grade ? parseFloat(form.grade) : null;
  const ectsNum = form.ects_earned ? parseFloat(form.ects_earned) : null;
  const isGradeValid = gradeNum === null || (!isNaN(gradeNum) && gs.isValid(gradeNum));
  const hasValue = (gradeNum !== null && isGradeValid) || (ectsNum !== null && ectsNum > 0);
  const selectedModule = modules.find(m => m.id === form.module_id);

  // Filter exams by selected module (if module matches exam title)
  const filteredExams = form.module_id
    ? exams
    : exams;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasValue) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      title: form.title,
      grade: gradeNum,
      ects_earned: ectsNum,
      date: form.date,
      module_id: form.module_id || null,
      exam_id: form.exam_id || null,
      weight: parseFloat(form.weight) || 1,
      exam_type: form.exam_type || null,
      notes: form.notes || null,
    };
    if (initial) {
      await supabase.from("grades").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("grades").insert({ ...payload, user_id: user.id });
    }

    // If linked to an exam, update exam description with status
    if (form.exam_id && gradeNum !== null) {
      const passed = gs.isPassing(gradeNum);
      const formatted = formatGrade(gradeNum, gs.country);
      const statusText = passed
        ? `✓ ${t("grades.modal.statusPassed", { label: formatted, ects: "", exam: "" })}`
        : `✗ ${t("grades.modal.statusFailed", { label: formatted, exam: "" })}`;
      await supabase.from("events").update({
        description: statusText,
      }).eq("id", form.exam_id);
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{initial ? t("grades.modal.editTitle") : t("grades.modal.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.moduleLabel")}</label>
            <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
              <option value="">{t("grades.modal.moduleSelect")}</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.name} {m.ects ? `(${m.ects} ${gs.creditLabel})` : ""}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1 flex items-center gap-1">
              <GraduationCap size={12} /> {t("grades.modal.examLabel")}
            </label>
            <select className="input" value={form.exam_id} onChange={e => set("exam_id", e.target.value)}>
              <option value="">{t("grades.modal.examSelect")}</option>
              {filteredExams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({formatDate(ex.start_dt)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.nameLabel")}</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("grades.modal.namePlaceholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.gradeLabel", { placeholder: gs.inputPlaceholder })}</label>
              <input className="input" type="number" step={gs.step} min={gs.min} max={gs.max} value={form.grade} onChange={e => set("grade", e.target.value)} placeholder={t("grades.modal.gradePlaceholder", { example: gs.passingGrade })} />
              <p className="text-[10px] text-surface-400 mt-0.5">{t("grades.modal.gradeHint", { creditLabel: gs.creditLabel })}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.ectsLabel", { creditLabel: gs.creditLabel })}</label>
              <input className="input" type="number" step="0.5" min="0" max="30" value={form.ects_earned} onChange={e => set("ects_earned", e.target.value)} placeholder={t("grades.modal.ectsPlaceholder")} />
              <p className="text-[10px] text-surface-400 mt-0.5">{t("grades.modal.ectsHint", { creditLabel: gs.creditLabel })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.weightLabel")}</label>
              <input className="input" type="number" step="0.5" min="0.5" max="5" value={form.weight} onChange={e => set("weight", e.target.value)} />
              <p className="text-[10px] text-surface-400 mt-0.5">{t("grades.modal.weightHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.dateLabel")}</label>
              <input className="input" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
          </div>

          {/* Status Preview */}
          {(gradeNum !== null || ectsNum !== null) && (() => {
            // Calculate what the module average would be WITH this new grade
            const moduleId = form.module_id;
            const otherGrades = moduleId
              ? allGrades.filter(g => g.module_id === moduleId && g.grade != null && g.id !== initial?.id)
              : [];
            const allWeights = otherGrades.reduce((s, g) => s + (g.weight ?? 1), 0) + (gradeNum !== null ? parseFloat(form.weight || "1") : 0);
            const allSum = otherGrades.reduce((s, g) => s + g.grade! * (g.weight ?? 1), 0) + (gradeNum !== null ? gradeNum * parseFloat(form.weight || "1") : 0);
            const projectedAvg = allWeights > 0 ? allSum / allWeights : null;
            const modulePassing = projectedAvg !== null && gs.isPassing(projectedAvg);
            const hasMultipleGrades = otherGrades.length > 0;

            return (
              <div className={`p-3 rounded-xl text-sm space-y-1 ${
                gradeNum !== null && gs.isPassing(gradeNum) ? "bg-green-50 text-green-700" :
                gradeNum !== null && !gs.isPassing(gradeNum) ? "bg-red-50 text-red-700" :
                "bg-blue-50 text-blue-700"
              }`}>
                {gradeNum !== null && gs.isPassing(gradeNum) && (
                  <p>✓ <strong>{t("grades.modal.passed")}</strong> — {getGradeLabelText(gradeNum, gs.country)}
                    {form.exam_id ? ` · ${t("grades.modal.examMarked")}` : ""}
                  </p>
                )}
                {gradeNum !== null && !gs.isPassing(gradeNum) && (
                  <p>✗ <strong>{t("grades.modal.failed")}</strong> — {getGradeLabelText(gradeNum, gs.country)}
                    {form.exam_id ? ` · ${t("grades.modal.examRetake")}` : ""}
                  </p>
                )}
                {gradeNum === null && ectsNum !== null && (
                  <p>📊 {ectsNum} {gs.creditLabel} {t("grades.modal.manualEcts")}</p>
                )}
                {/* Module average info */}
                {moduleId && projectedAvg !== null && hasMultipleGrades && (
                  <p className="text-xs opacity-80">
                    {t("grades.modal.moduleAvg")}: <strong>{projectedAvg.toFixed(2)}</strong>
                    {modulePassing
                      ? ` — ${selectedModule?.ects ?? 0} ${gs.creditLabel} ${t("grades.modal.ectsEarned")}`
                      : ` — ${t("grades.modal.ectsNotYet")}`
                    }
                  </p>
                )}
                {moduleId && projectedAvg !== null && !hasMultipleGrades && gs.isPassing(gradeNum ?? 0) && selectedModule?.ects && (
                  <p className="text-xs opacity-80">
                    {selectedModule.ects} {gs.creditLabel} {t("grades.modal.ectsIfAvgHolds")}
                  </p>
                )}
                {/* Needed grade hint when module avg is below passing */}
                {moduleId && projectedAvg !== null && !modulePassing && (() => {
                  const currentGrades = [...otherGrades];
                  if (gradeNum !== null) currentGrades.push({ grade: gradeNum, weight: parseFloat(form.weight || "1"), module_id: moduleId } as any);
                  const cSum = currentGrades.reduce((s: number, g: any) => s + (g.grade ?? 0) * (g.weight ?? 1), 0);
                  const cWeight = currentGrades.reduce((s: number, g: any) => s + (g.weight ?? 1), 0);
                  const needed = (gs.passingGrade * (cWeight + 1) - cSum) / 1;
                  const rounded = Math.round(needed * 100) / 100;
                  if (rounded > gs.max) return (
                    <p className="text-xs font-medium">⚠️ {t("grades.modal.targetUnreachable", { target: gs.passingGrade.toFixed(1) })}</p>
                  );
                  return (
                    <p className="text-xs font-medium">
                      📌 {t("grades.modal.needsGrade", { grade: rounded.toFixed(1), target: gs.passingGrade.toFixed(1) })}
                    </p>
                  );
                })()}
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.typeLabel")}</label>
            <select className="input" value={form.exam_type} onChange={e => set("exam_type", e.target.value)}>
              <option value="">{t("grades.modal.typeDefault")}</option>
              <option value="Schlussprüfung">{t("grades.modal.typeFinal")}</option>
              <option value="Zwischenprüfung">{t("grades.modal.typeMid")}</option>
              <option value="Testat">{t("grades.modal.typeAttest")}</option>
              <option value="Hausarbeit">{t("grades.modal.typeEssay")}</option>
              <option value="Projekt">{t("grades.modal.typeProject")}</option>
              <option value="Präsentation">{t("grades.modal.typePresentation")}</option>
              <option value="Mitarbeit">{t("grades.modal.typeParticipation")}</option>
              <option value="Mündlich">{t("grades.modal.typeOral")}</option>
              <option value="Online-Prüfung">{t("grades.modal.typeOnline")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("grades.modal.notesLabel")}</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder={t("grades.modal.notesPlaceholder")} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("credits.cancel")}</button>
            <button type="submit" disabled={saving || !hasValue} className="btn-primary flex-1 justify-center">
              {saving ? t("credits.saving") : t("credits.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
