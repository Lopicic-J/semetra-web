"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Award, CheckCircle, Clock, TrendingUp, BookOpen, AlertTriangle, Calendar, Pencil, Save, X } from "lucide-react";
import type { Module, Grade } from "@/types/database";

const DEGREE_ECTS = 180;

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

  // Weighted average of passed modules
  const weightedGrades = passedModules.map(m => {
    const bg = bestGrade(m.id)!;
    return { grade: bg, ects: m.ects ?? 0 };
  });
  const totalWeight = weightedGrades.reduce((s, g) => s + g.ects, 0);
  const weightedAvg = totalWeight > 0
    ? weightedGrades.reduce((s, g) => s + g.grade * g.ects, 0) / totalWeight
    : 0;

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
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="text-violet-600" size={26} />
          Credits & ECTS
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          ECTS-Fortschritt basierend auf deinen Noten (bestanden ab Note 4.0)
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<CheckCircle className="text-green-600" size={20} />}
          label="Bestanden"
          value={`${earnedEcts} ECTS`}
          sub={`${passedModules.length} Module · ø ${weightedAvg > 0 ? weightedAvg.toFixed(2) : "—"}`}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="text-blue-600" size={20} />}
          label="In Bearbeitung"
          value={`${activeEcts} ECTS`}
          sub={`${activeModules.length} Module`}
          color="blue"
        />
        <StatCard
          icon={<Clock className="text-amber-600" size={20} />}
          label="Offen"
          value={`${plannedEcts} ECTS`}
          sub={`${plannedModules.length} Module`}
          color="amber"
        />
        <StatCard
          icon={<AlertTriangle className="text-red-500" size={20} />}
          label="Nicht bestanden"
          value={`${failedEcts} ECTS`}
          sub={`${failedModules.length} Module`}
          color="red"
        />
      </div>

      {/* Progress toward degree */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Fortschritt Abschluss (BSc = 180 ECTS)</h2>
          <span className="text-2xl font-bold text-violet-600">{progressPct}%</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{earnedEcts} / {DEGREE_ECTS} ECTS erlangt</span>
          <span>{DEGREE_ECTS - earnedEcts} ECTS verbleibend</span>
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
      <h2 className="font-semibold text-gray-800 mb-4">Semesterübersicht</h2>
      {sortedSemesters.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Award size={40} className="mx-auto mb-3 opacity-30" />
          <p>Keine Module gefunden.</p>
          <p className="text-sm mt-1">Importiere einen Studiengang oder füge Module manuell hinzu.</p>
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
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800 text-sm">{sem}</span>
                    <span className="text-xs text-gray-500">{mods.length} Module · {semEcts} ECTS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-green-600 font-medium">{semEarned}/{semEcts} ECTS</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${semPct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {mods.map(m => {
                    const status = moduleStatus(m);
                    const bg = bestGrade(m.id);
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 ${status === "failed" ? "bg-red-50/30" : ""}`}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="text-sm text-gray-800 flex-1">{m.name}</span>
                        {m.code && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{m.code}</span>
                        )}
                        {bg !== null && (
                          <span className={`text-xs font-bold ${bg >= 4.0 ? "text-green-600" : "text-red-600"}`}>
                            {bg.toFixed(1)}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 w-14 text-right">{m.ects ?? "—"} ECTS</span>
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
    violet: "bg-violet-50",
    red: "bg-red-50",
  };
  return (
    <div className={`rounded-2xl p-4 ${bg[color] ?? "bg-gray-50"}`}>
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
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
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Calendar size={18} className="text-violet-500" />
          Studienzeitraum
        </h2>
        <button
          onClick={onToggleEdit}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
          title={editing ? "Abbrechen" : "Bearbeiten"}
        >
          {editing ? <X size={16} /> : <Pencil size={14} />}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Studienbeginn</label>
              <input
                type="date"
                value={editStart}
                onChange={e => onEditStart(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Studienende (geplant)</label>
              <input
                type="date"
                value={editEnd}
                onChange={e => onEditEnd(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            Freiwillig — wenn du das genaue Datum nicht kennst, trage ein ungefähres ein.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onToggleEdit} className="px-3 py-1.5 text-xs rounded-lg hover:bg-gray-100 text-gray-500">
              Abbrechen
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              <Save size={12} /> {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div>
          {/* Time progress bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isFinished
                  ? "bg-gradient-to-r from-green-400 to-emerald-500"
                  : "bg-gradient-to-r from-violet-400 to-indigo-500"
              }`}
              style={{ width: `${isFinished ? 100 : timePct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDateDE(studyStart)}</span>
            {isFinished ? (
              <span className="text-green-600 font-semibold">Studium abgeschlossen!</span>
            ) : (
              <span className="font-medium text-violet-600">
                Noch {remainingLabel} · {timePct}% der Studienzeit vorbei
              </span>
            )}
            <span>{formatDateDE(studyEnd)}</span>
          </div>

          {/* Quick stats */}
          {!isFinished && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-gray-800">{totalMonths}</p>
                <p className="text-[10px] text-gray-400">Monate gesamt</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-violet-600">{elapsedMonths}</p>
                <p className="text-[10px] text-gray-400">Monate absolviert</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-indigo-600">{remainingMonths}</p>
                <p className="text-[10px] text-gray-400">Monate verbleibend</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">
            Trage deinen Studienzeitraum ein, um den zeitlichen Fortschritt zu sehen.
          </p>
          <button
            onClick={onToggleEdit}
            className="text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            Studienzeitraum eintragen →
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    passed:  "bg-green-100 text-green-700",
    failed:  "bg-red-100 text-red-700",
    active:  "bg-blue-100 text-blue-700",
    planned: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    passed:  "✓ bestanden",
    failed:  "✗ n. best.",
    active:  "aktiv",
    planned: "offen",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}
