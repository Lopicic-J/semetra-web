"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import {
  BookOpen, CheckCircle, Clock, Award, ChevronDown, ChevronRight,
  Eye, EyeOff, Pencil, GraduationCap, Target
} from "lucide-react";
import type { Module, Task } from "@/types/database";

const SEMESTER_ORDER = ["HS1","FS2","HS3","FS4","HS5","FS6","HS7","FS8","HS9",
  "HS24","FS25","HS25","FS26","HS26","FS27","HS27","FS28"];

function sortSemester(a: string, b: string) {
  const ai = SEMESTER_ORDER.indexOf(a);
  const bi = SEMESTER_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  planned:   { bg: "bg-gray-100",  text: "text-gray-600",  label: "Geplant" },
  active:    { bg: "bg-blue-100",  text: "text-blue-700",  label: "Aktiv" },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Abgeschlossen" },
  paused:    { bg: "bg-amber-100", text: "text-amber-700", label: "Pausiert" },
};

const TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pflicht:     { bg: "bg-blue-50",   text: "text-blue-600",   label: "Pflicht" },
  wahl:        { bg: "bg-amber-50",  text: "text-amber-600",  label: "Wahl" },
  vertiefung:  { bg: "bg-purple-50", text: "text-purple-600", label: "Vertiefung" },
};

export default function StudienplanPage() {
  const { modules, refetch: refetchModules } = useModules();
  const { tasks } = useTasks();
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [expandedSemesters, setExpandedSemesters] = useState<Set<string>>(new Set(SEMESTER_ORDER));
  const supabase = createClient();

  // Group modules by semester
  const bySemester = useMemo(() => {
    const groups: Record<string, Module[]> = {};
    modules.forEach(m => {
      const sem = m.semester ?? "Nicht zugeordnet";
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push(m);
    });
    return groups;
  }, [modules]);

  const sortedSemesters = useMemo(() =>
    Object.keys(bySemester).sort(sortSemester),
    [bySemester]
  );

  // Stats
  const inPlanModules = modules.filter(m => m.in_plan !== false);
  const totalEcts = inPlanModules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const completedEcts = inPlanModules.filter(m => m.status === "completed").reduce((s, m) => s + (m.ects ?? 0), 0);
  const activeCount = inPlanModules.filter(m => m.status === "active").length;
  const completedCount = inPlanModules.filter(m => m.status === "completed").length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "done").length;

  // Module tasks
  const moduleTasks = selectedModule
    ? tasks.filter(t => t.module_id === selectedModule.id)
    : [];

  async function toggleInPlan(mod: Module) {
    const newVal = !(mod.in_plan ?? true);
    await supabase.from("modules").update({ in_plan: newVal }).eq("id", mod.id);
    refetchModules();
    if (selectedModule?.id === mod.id) {
      setSelectedModule({ ...mod, in_plan: newVal });
    }
  }

  function toggleSemester(sem: string) {
    setExpandedSemesters(prev => {
      const n = new Set(prev);
      n.has(sem) ? n.delete(sem) : n.add(sem);
      return n;
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="text-violet-600" size={26} />
          Studienplan
        </h1>
        <p className="text-gray-500 text-sm mt-1">Dein Semester-Roadmap — der Fels in der Brandung</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl p-4 bg-violet-50">
          <Award className="text-violet-600 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900">{completedEcts}/{totalEcts}</p>
          <p className="text-xs text-gray-600">ECTS erreicht</p>
        </div>
        <div className="rounded-2xl p-4 bg-blue-50">
          <BookOpen className="text-blue-600 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-600">Aktive Module</p>
        </div>
        <div className="rounded-2xl p-4 bg-green-50">
          <CheckCircle className="text-green-600 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900">{completedCount}/{inPlanModules.length}</p>
          <p className="text-xs text-gray-600">Module abgeschlossen</p>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50">
          <Clock className="text-amber-600 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900">{doneTasks}/{totalTasks}</p>
          <p className="text-xs text-gray-600">Aufgaben erledigt</p>
        </div>
      </div>

      {/* ECTS Progress bar */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">ECTS-Fortschritt</span>
          <span className="text-sm font-bold text-violet-600">{totalEcts > 0 ? Math.round((completedEcts / totalEcts) * 100) : 0}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${totalEcts > 0 ? (completedEcts / totalEcts) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Main content: Semesters + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Semester blocks */}
        <div className="lg:col-span-3 space-y-4">
          {sortedSemesters.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch keine Module</p>
              <p className="text-sm mt-1">Importiere einen Studiengang oder erstelle Module manuell.</p>
            </div>
          ) : (
            sortedSemesters.map(sem => {
              const mods = bySemester[sem];
              const semEcts = mods.filter(m => m.in_plan !== false).reduce((s, m) => s + (m.ects ?? 0), 0);
              const semCompleted = mods.filter(m => m.status === "completed" && m.in_plan !== false).reduce((s, m) => s + (m.ects ?? 0), 0);
              const isExpanded = expandedSemesters.has(sem);

              return (
                <div key={sem} className="card p-0 overflow-hidden">
                  {/* Semester header */}
                  <button
                    onClick={() => toggleSemester(sem)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                      <span className="font-semibold text-gray-800">{sem}</span>
                      <span className="text-xs text-gray-500">{mods.length} Module · {semEcts} ECTS</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${semEcts > 0 ? (semCompleted / semEcts) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8 text-right">
                        {semEcts > 0 ? Math.round((semCompleted / semEcts) * 100) : 0}%
                      </span>
                    </div>
                  </button>

                  {/* Module cards */}
                  {isExpanded && (
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {mods.map(mod => {
                        const isInPlan = mod.in_plan !== false;
                        const status = STATUS_COLORS[mod.status ?? "planned"] ?? STATUS_COLORS.planned;
                        const type = TYPE_BADGES[mod.module_type ?? "pflicht"] ?? TYPE_BADGES.pflicht;
                        const isSelected = selectedModule?.id === mod.id;

                        return (
                          <button
                            key={mod.id}
                            onClick={() => setSelectedModule(mod)}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              isSelected
                                ? "border-violet-300 bg-violet-50 shadow-sm"
                                : isInPlan
                                  ? "border-gray-100 hover:border-violet-200 hover:bg-gray-50"
                                  : "border-gray-100 opacity-50 hover:opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: mod.color }} />
                              <span className={`text-sm font-medium flex-1 truncate ${!isInPlan ? "line-through text-gray-400" : "text-gray-800"}`}>
                                {mod.name}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleInPlan(mod); }}
                                className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
                                title={isInPlan ? "Aus Plan entfernen" : "In Plan aufnehmen"}
                              >
                                {isInPlan ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
                                {status.label}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${type.bg} ${type.text}`}>
                                {type.label}
                              </span>
                              <span className="text-[10px] text-gray-500">{mod.ects ?? 0} ECTS</span>
                              {mod.exam_date && (
                                <span className="text-[10px] text-gray-400">Prüfung: {mod.exam_date}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detail panel */}
        <div className="lg:col-span-2">
          {selectedModule ? (
            <div className="card sticky top-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: selectedModule.color }}>
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{selectedModule.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedModule.code && `${selectedModule.code} · `}
                    {selectedModule.ects ?? 0} ECTS · {selectedModule.semester ?? "—"}
                  </p>
                </div>
              </div>

              {/* Module info */}
              <div className="space-y-2 mb-4 text-sm">
                {selectedModule.professor && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dozent</span>
                    <span className="text-gray-800">{selectedModule.professor}</span>
                  </div>
                )}
                {selectedModule.exam_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prüfung</span>
                    <span className="text-gray-800">{selectedModule.exam_date}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`${STATUS_COLORS[selectedModule.status ?? "planned"].text} font-medium`}>
                    {STATUS_COLORS[selectedModule.status ?? "planned"].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Typ</span>
                  <span className="text-gray-800">{TYPE_BADGES[selectedModule.module_type ?? "pflicht"]?.label ?? "Pflicht"}</span>
                </div>
              </div>

              {/* Links */}
              {(selectedModule.link || selectedModule.github_link || selectedModule.sharepoint_link) && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {selectedModule.link && (
                    <a href={selectedModule.link} target="_blank" rel="noopener" className="text-xs text-violet-600 hover:underline">Moodle</a>
                  )}
                  {selectedModule.github_link && (
                    <a href={selectedModule.github_link} target="_blank" rel="noopener" className="text-xs text-violet-600 hover:underline">GitHub</a>
                  )}
                  {selectedModule.sharepoint_link && (
                    <a href={selectedModule.sharepoint_link} target="_blank" rel="noopener" className="text-xs text-violet-600 hover:underline">SharePoint</a>
                  )}
                </div>
              )}

              {/* Tasks for this module */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Aufgaben ({moduleTasks.length})</h4>
                {moduleTasks.length === 0 ? (
                  <p className="text-xs text-gray-400">Keine Aufgaben für dieses Modul.</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {moduleTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          t.status === "done" ? "bg-green-500" : t.status === "in_progress" ? "bg-blue-500" : "bg-gray-300"
                        }`} />
                        <span className={`flex-1 truncate ${t.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {t.title}
                        </span>
                        {t.due_date && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(t.due_date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-400 sticky top-6">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Wähle ein Modul für Details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
