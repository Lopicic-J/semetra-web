"use client";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Award, CheckCircle, Clock, TrendingUp, BookOpen, AlertTriangle, Calendar, Pencil, Save, X } from "lucide-react";
import { ectsWeightedAvg, roundGrade, gradeColor, gradeLabel } from "@/lib/utils";
import type { Module, Grade } from "@/types/database";

const DEGREE_ECTS = 180;

// Note: displaySemester kept in German for internal use, translations handled at component level
function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "Kein Semester";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

function semesterNum(s: string): number {
  const match = s.match(/(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

export default function CreditsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { profile, refetch: refetchProfile } = useProfile();
  const [modules, setModules] = useState<Module[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  // Study period editing
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [studyStart, setStudyStart] = useState("");
  const [studyEnd, setStudyEnd] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Sync form with profile
  useEffect(() => {
    if (profile) {
      setStudyStart(profile.study_start ?? "");
      setStudyEnd(profile.study_end ?? "");
    }
  }, [profile]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [modRes, gradeRes] = await Promise.all([
      supabase.from("modules").select("*").eq("user_id", user.id).order("semester"),
      supabase.from("grades").select("*").eq("user_id", user.id),
    ]);
    setModules(modRes.data ?? []);
    setGrades(gradeRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function saveStudyPeriod() {
    if (!profile) return;
    setSavingPeriod(true);
    await supabase.from("profiles").update({
      study_start: studyStart || null,
      study_end: studyEnd || null,
    }).eq("id", profile.id);
    await refetchProfile();
    setEditingPeriod(false);
    setSavingPeriod(false);
  }

  // Grade-based ECTS calculation
  function bestGrade(moduleId: string): number | null {
    const mg = grades.filter(g => g.module_id === moduleId);
    if (mg.length === 0) return null;
    const valid = mg.filter(g => g.grade !== null).map(g => g.grade as number);
    if (valid.length === 0) return null;
    return Math.max(...valid);
  }

  function moduleStatus(m: Module): "passed" | "failed" | "active" | "planned" {
    const bg = bestGrade(m.id);
    if (bg !== null && bg >= 4.0) return "passed";
    if (bg !== null && bg < 4.0) return "failed";
    if (m.status === "active") return "active";
    return "planned";
  }

  const passedModules = modules.filter(m => moduleStatus(m) === "passed");
  const failedModules = modules.filter(m => moduleStatus(m) === "failed");
  const activeModules = modules.filter(m => moduleStatus(m) === "active");
  const plannedModules = modules.filter(m => moduleStatus(m) === "planned");

  const earnedEcts  = passedModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const activeEcts  = activeModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const plannedEcts = plannedModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const failedEcts  = failedModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const totalEcts   = modules.reduce((s, m) => s + (m.ects ?? 0), 0);

  const progressPct = Math.min(100, Math.round((earnedEcts / DEGREE_ECTS) * 100));

  // ECTS-weighted average of passed modules (Swiss standard)
  const weightedAvg = ectsWeightedAvg(
    passedModules.map(m => ({ grade: bestGrade(m.id)!, ects: m.ects ?? 0 }))
  );

  // Group by semester (normalized)
  const bySemester = modules.reduce<Record<string, Module[]>>((acc, m) => {
    const sem = displaySemester(m.semester);
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(m);
    return acc;
  }, {});
  const sortedSemesters = Object.keys(bySemester).sort((a, b) => semesterNum(a) - semesterNum(b));

  if (loading) {
    return (
      <div className="p-3 sm:p-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-surface-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex flex-col sm:flex-row sm:items-center gap-2">
          <Award className="text-brand-600" size={26} />
          {t("credits.title")}
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          {t("credits.subtitle")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<CheckCircle className="text-green-600" size={20} />}
          label={t("credits.statPassed")}
          value={`${earnedEcts} ECTS`}
          sub={`${passedModules.length} Module · ø ${weightedAvg > 0 ? roundGrade(weightedAvg).toFixed(2) : "—"}`}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="text-blue-600" size={20} />}
          label={t("credits.statActive")}
          value={`${activeEcts} ECTS`}
          sub={`${activeModules.length} Module`}
          color="blue"
        />
        <StatCard
          icon={<Clock className="text-amber-600" size={20} />}
          label={t("credits.statPending")}
          value={`${plannedEcts} ECTS`}
          sub={`${plannedModules.length} Module`}
          color="amber"
        />
        <StatCard
          icon={<AlertTriangle className="text-red-500" size={20} />}
          label={t("credits.statFailed")}
          value={`${failedEcts} ECTS`}
          sub={`${failedModules.length} Module`}
          color="red"
        />
      </div>

      {/* Progress toward degree */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-surface-800">{t("credits.progressTitle")}</h2>
          <span className="text-2xl font-bold text-brand-600">{progressPct}%</span>
        </div>
        <div className="h-4 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-surface-500 mt-2">
          <span>{t("credits.progressEarned", { earned: earnedEcts, total: DEGREE_ECTS })}</span>
          <span>{t("credits.progressRemaining", { remaining: DEGREE_ECTS - earnedEcts })}</span>
        </div>
      </div>

      {/* Study period */}
      <StudyPeriodCard
        studyStart={profile?.study_start ?? null}
        studyEnd={profile?.study_end ?? null}
        editing={editingPeriod}
        editStart={studyStart}
        editEnd={studyEnd}
        saving={savingPeriod}
        onEditStart={setStudyStart}
        onEditEnd={setStudyEnd}
        onToggleEdit={() => { setEditingPeriod(!editingPeriod); setStudyStart(profile?.study_start ?? ""); setStudyEnd(profile?.study_end ?? ""); }}
        onSave={saveStudyPeriod}
      />

      {/* Semester breakdown */}
      <h2 className="font-semibold text-surface-800 mb-4">{t("credits.semesterOverview")}</h2>
      {sortedSemesters.length === 0 ? (
        <div className="text-center py-12 text-surface-400">
          <Award size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t("credits.noModules")}</p>
          <p className="text-sm mt-1">{t("credits.noModulesHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSemesters.map(sem => {
            const mods = bySemester[sem];
            const semEcts = mods.reduce((s, m) => s + (m.ects ?? 0), 0);
            const semEarned = mods.filter(m => moduleStatus(m) === "passed").reduce((s, m) => s + (m.ects ?? 0), 0);
            const semPct = semEcts > 0 ? Math.round((semEarned / semEcts) * 100) : 0;

            return (
              <div key={sem} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-50 border-b border-surface-100">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-surface-800 text-sm">{sem}</span>
                    <span className="text-xs text-surface-500">{mods.length} Module · {semEcts} ECTS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-green-600 font-medium">{semEarned}/{semEcts} ECTS</span>
                    <div className="w-24 h-2 bg-surface-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${semPct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-surface-50">
                  {mods.map(m => {
                    const status = moduleStatus(m);
                    const bg = bestGrade(m.id);
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50/50 ${status === "failed" ? "bg-red-50/30" : ""}`}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="text-sm text-surface-800 flex-1">{m.name}</span>
                        {m.code && (
                          <span className="text-[10px] font-mono text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">{m.code}</span>
                        )}
                        {bg !== null && (
                          <span className={`text-xs font-bold ${bg >= 4.0 ? "text-green-600" : "text-red-600"}`}>
                            {bg.toFixed(1)}
                          </span>
                        )}
                        <span className="text-xs text-surface-500 w-14 text-right">{m.ects ?? "—"} ECTS</span>
                        <StatusBadge status={status} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const bg: Record<string, string> = {
    green: "bg-green-50",
    blue: "bg-blue-50",
    amber: "bg-amber-50",
    violet: "bg-brand-50",
    red: "bg-red-50",
  };
  return (
    <div className={`rounded-2xl p-4 ${bg[color] ?? "bg-surface-50"}`}>
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold text-surface-900">{value}</p>
      <p className="text-xs font-medium text-surface-600">{label}</p>
      <p className="text-xs text-surface-400 mt-0.5">{sub}</p>
    </div>
  );
}

function StudyPeriodCard({
  studyStart, studyEnd, editing, editStart, editEnd, saving,
  onEditStart, onEditEnd, onToggleEdit, onSave,
}: {
  studyStart: string | null;
  studyEnd: string | null;
  editing: boolean;
  editStart: string;
  editEnd: string;
  saving: boolean;
  onEditStart: (v: string) => void;
  onEditEnd: (v: string) => void;
  onToggleEdit: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const now = new Date();
  const start = studyStart ? new Date(studyStart) : null;
  const end = studyEnd ? new Date(studyEnd) : null;

  // Calculate time progress
  let timePct = 0;
  let totalMonths = 0;
  let elapsedMonths = 0;
  let remainingMonths = 0;
  let remainingLabel = "";

  if (start && end && end > start) {
    totalMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    elapsedMonths = Math.max(0, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    remainingMonths = Math.max(0, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    timePct = Math.min(100, Math.max(0, Math.round((elapsedMonths / totalMonths) * 100)));

    if (remainingMonths > 12) {
      const years = Math.floor(remainingMonths / 12);
      const months = remainingMonths % 12;
      remainingLabel = months > 0 ? `${years}J ${months}M` : `${years} Jahr${years > 1 ? "e" : ""}`;
    } else {
      remainingLabel = `${remainingMonths} Monat${remainingMonths !== 1 ? "e" : ""}`;
    }
  }

  const hasData = start && end;
  const isFinished = end && now > end;

  const formatDateDE = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("de-CH", { month: "long", year: "numeric" });
  };

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-surface-800 flex items-center gap-2">
          <Calendar size={18} className="text-brand-500" />
          {t("credits.studyPeriod")}
        </h2>
        <button
          onClick={onToggleEdit}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-brand-600 transition-colors"
          title={editing ? t("credits.cancel") : t("credits.editStudyPeriod")}
        >
          {editing ? <X size={16} /> : <Pencil size={14} />}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">{t("credits.studyStartLabel")}</label>
              <input
                type="date"
                value={editStart}
                onChange={e => onEditStart(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">{t("credits.studyEndLabel")}</label>
              <input
                type="date"
                value={editEnd}
                onChange={e => onEditEnd(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
          <p className="text-[10px] text-surface-400">
            {t("credits.studyPeriodOptional")}
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onToggleEdit} className="px-3 py-1.5 text-xs rounded-lg hover:bg-surface-100 text-surface-500">
              {t("credits.cancel")}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              <Save size={12} /> {saving ? t("credits.saving") : t("credits.save")}
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div>
          {/* Time progress bar */}
          <div className="h-3 bg-surface-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isFinished
                  ? "bg-gradient-to-r from-green-400 to-emerald-500"
                  : "bg-gradient-to-r from-brand-400 to-indigo-500"
              }`}
              style={{ width: `${isFinished ? 100 : timePct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-surface-500">
            <span>{formatDateDE(studyStart)}</span>
            {isFinished ? (
              <span className="text-green-600 font-semibold">{t("credits.completed")}</span>
            ) : (
              <span className="font-medium text-brand-600">
                {t("credits.timeRemaining", { time: remainingLabel, percent: timePct })}
              </span>
            )}
            <span>{formatDateDE(studyEnd)}</span>
          </div>

          {/* Quick stats */}
          {!isFinished && (
            <div className="flex gap-2 sm:gap-4 mt-3 pt-3 border-t border-surface-100">
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-surface-800">{totalMonths}</p>
                <p className="text-[10px] text-surface-400">{t("credits.totalMonths")}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-brand-600">{elapsedMonths}</p>
                <p className="text-[10px] text-surface-400">{t("credits.elapsedMonths")}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-brand-700">{remainingMonths}</p>
                <p className="text-[10px] text-surface-400">{t("credits.remainingMonths")}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-surface-400 mb-2">
            {t("credits.enterStudyPeriod")}
          </p>
          <button
            onClick={onToggleEdit}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {t("credits.enterPeriod")}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    passed:  "bg-green-100 text-green-700",
    failed:  "bg-red-100 text-red-700",
    active:  "bg-blue-100 text-blue-700",
    planned: "bg-surface-100 text-surface-500",
  };
  const labels: Record<string, string> = {
    passed:  t("credits.statusPassed"),
    failed:  t("credits.statusFailed"),
    active:  t("credits.statusActive"),
    planned: t("credits.statusPlanned"),
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? "bg-surface-100 text-surface-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}
