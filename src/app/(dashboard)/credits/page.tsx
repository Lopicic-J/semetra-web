"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Award, CheckCircle, Clock, TrendingUp, BookOpen } from "lucide-react";
import type { Module } from "@/types/database";

const DEGREE_ECTS = 180;

const SEMESTER_ORDER = ["HS1","FS2","HS3","FS4","HS5","FS6","HS7","FS8",
  "HS24","FS25","HS25","FS26","HS26","FS27"];

function sortSemester(a: string, b: string) {
  const ai = SEMESTER_ORDER.indexOf(a);
  const bi = SEMESTER_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export default function CreditsPage() {
  const supabase = createClient();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", user.id)
      .order("semester");
    setModules(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const completedModules = modules.filter(m => m.status === "completed");
  const activeModules    = modules.filter(m => m.status === "active");
  const plannedModules   = modules.filter(m => m.status === "planned");

  const earnedEcts  = completedModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const activeEcts  = activeModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const plannedEcts = plannedModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const totalEcts   = modules.reduce((s, m) => s + (m.ects ?? 0), 0);

  const progressPct = Math.min(100, Math.round((earnedEcts / DEGREE_ECTS) * 100));

  const bySemester = modules.reduce<Record<string, Module[]>>((acc, m) => {
    const sem = m.semester ?? "Kein Semester";
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(m);
    return acc;
  }, {});

  const sortedSemesters = Object.keys(bySemester).sort(sortSemester);

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
          Dein ECTS-Fortschritt auf dem Weg zum Abschluss
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<CheckCircle className="text-green-600" size={20} />}
          label="Abgeschlossen"
          value={`${earnedEcts} ECTS`}
          sub={`${completedModules.length} Module`}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="text-blue-600" size={20} />}
          label="Aktuell aktiv"
          value={`${activeEcts} ECTS`}
          sub={`${activeModules.length} Module`}
          color="blue"
        />
        <StatCard
          icon={<Clock className="text-amber-600" size={20} />}
          label="Geplant"
          value={`${plannedEcts} ECTS`}
          sub={`${plannedModules.length} Module`}
          color="amber"
        />
        <StatCard
          icon={<BookOpen className="text-violet-600" size={20} />}
          label="Gesamt geplant"
          value={`${totalEcts} ECTS`}
          sub={`${modules.length} Module`}
          color="violet"
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
          <span>{earnedEcts} / {DEGREE_ECTS} ECTS erreicht</span>
          <span>{DEGREE_ECTS - earnedEcts} ECTS verbleibend</span>
        </div>
      </div>

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
            const semCompleted = mods.filter(m => m.status === "completed").reduce((s, m) => s + (m.ects ?? 0), 0);
            const semPct = semEcts > 0 ? Math.round((semCompleted / semEcts) * 100) : 0;

            return (
              <div key={sem} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800 text-sm">{sem}</span>
                    <span className="text-xs text-gray-500">{mods.length} Module · {semEcts} ECTS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${semPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{semPct}%</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {mods.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="text-sm text-gray-800 flex-1">{m.name}</span>
                      {m.code && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {m.code}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 w-14 text-right">{m.ects ?? "—"} ECTS</span>
                      <StatusBadge status={m.status ?? "planned"} />
                    </div>
                  ))}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    active:    "bg-blue-100 text-blue-700",
    planned:   "bg-gray-100 text-gray-500",
    paused:    "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = {
    completed: "✓ fertig",
    active:    "aktiv",
    planned:   "geplant",
    paused:    "pausiert",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}
