"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";
import { MODULE_COLORS } from "@/lib/utils";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { UpgradeModal, LimitNudge, LimitCounter } from "@/components/ui/ProGate";
import {
  Plus, BookOpen, Pencil, Trash2, X, ExternalLink, Github,
  FileText, Link2, CheckCircle, Clock, AlertCircle, PauseCircle,
  CheckSquare, Square, XSquare, AlertTriangle, Loader2,
  Building2, RotateCcw, ClipboardList, ChevronRight
} from "lucide-react";
import { ProGate } from "@/components/ui/ProGate";
import type { Module } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

const SEMESTERS = ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8","Semester 9"];
const DAYS = ["Mo","Di","Mi","Do","Fr","Sa"];

/** Map legacy codes like "HS1" / "FS2" to "Semester 1" / "Semester 2" */
function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}
const MODULE_TYPES = ["pflicht","wahl","vertiefung"];
const STATUS_OPTIONS = ["planned","active","completed","paused","credited"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  planned:   { label: "Geplant",      icon: Clock,        cls: "bg-surface-100 text-surface-600" },
  active:    { label: "Aktiv",        icon: AlertCircle,  cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Abgeschlossen",icon: CheckCircle,  cls: "bg-green-50 text-green-700" },
  paused:    { label: "Pausiert",     icon: PauseCircle,  cls: "bg-amber-50 text-amber-700" },
  credited:  { label: "Angerechnet",  icon: CheckSquare,  cls: "bg-purple-50 text-purple-700" },
};

export default function ModulesPage() {
  const { t } = useTranslation();
  const { modules, loading, refetch } = useModules();
  const { profile, isPro, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; names: string[] } | null>(null);
  const [autoImporting, setAutoImporting] = useState(false);
  const autoImportTriggered = useRef(false);
  const supabase = createClient();

  // ── Auto-import: Builder template modules (program → student) ──
  // Runs when institution_modules_loaded is false (reset by enrollment API on program switch).
  // Delegates to server-side API route that uses service client to read templates.
  useEffect(() => {
    if (autoImportTriggered.current) return;
    if (loading || profileLoading || !profile) return;
    if (profile.institution_modules_loaded) return;
    if (!profile.active_program_id) return;
    autoImportTriggered.current = true;

    (async () => {
      setAutoImporting(true);
      try {
        const res = await fetch("/api/academic/modules/auto-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPro }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Auto-import API error:", err);
        }
        refetchProfile();
        refetch();
      } catch (err) {
        console.error("Auto-import failed:", err);
      } finally {
        setAutoImporting(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profileLoading, profile]);

  // Count hidden institution modules for restore badge
  const [hiddenCount, setHiddenCount] = useState(0);
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count } = await supabase
        .from("modules")
        .select("id", { count: "exact", head: true })
        .not("hidden_at", "is", null)
        .eq("source", "institution");
      setHiddenCount(count ?? 0);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, modules]);

  function openNew() {
    const check = withinFreeLimit("modules", modules.length, isPro);
    if (!check.allowed) {
      setShowUpgrade(true);
      return;
    }
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(m: Module) { setEditing(m); setShowForm(true); }

  function handleDelete(id: string) {
    const mod = modules.find(m => m.id === id);
    setDeleteTarget({ ids: [id], names: [mod?.name ?? "Modul"] });
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const names = ids.map(id => modules.find(m => m.id === id)?.name ?? "Modul");
    setDeleteTarget({ ids, names });
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(m => m.id)));
    }
  }

  const filtered = filter === "all" ? modules : modules.filter(m => (m.status ?? "active") === filter);

  const isPageLoading = loading || profileLoading || autoImporting;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-surface-900 dark:text-white">Module</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
            {modules.length} Module · {modules.reduce((s, m) => s + (m.ects ?? 0), 0)} ECTS total
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LimitCounter current={modules.length} max={FREE_LIMITS.modules} isPro={isPro} />
          {modules.length > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`btn-secondary gap-2 text-sm ${selectMode ? "bg-brand-50 text-brand-700 border-brand-200" : ""}`}
            >
              {selectMode ? <XSquare size={15} /> : <CheckSquare size={15} />}
              {selectMode ? t("common.cancel") : t("modules.select")}
            </button>
          )}
          {hiddenCount > 0 && (
            <button onClick={() => setShowRestore(true)} className="btn-secondary gap-2 text-sm text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20">
              <RotateCcw size={15} /> Wiederherstellen
              <span className="ml-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 px-1.5 py-0.5 rounded-full">{hiddenCount}</span>
            </button>
          )}
          <button onClick={openNew} className="btn-primary gap-2">
            <Plus size={16} /> {t("modules.moduleName")}
          </button>
        </div>
      </div>

      {/* Mobile: Quick link to tasks */}
      <Link href="/tasks" className="flex sm:hidden items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-surface-50 border border-surface-200 text-sm text-surface-600 hover:bg-surface-100 transition-colors">
        <ClipboardList size={16} className="text-green-500 flex-shrink-0" />
        <span className="flex-1">Aufgaben anzeigen</span>
        <ChevronRight size={14} className="text-surface-400 flex-shrink-0" />
      </Link>

      {/* Auto-import banner */}
      {autoImporting && (
        <div className="flex items-center gap-3 mb-4 p-3 sm:p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl">
          <Loader2 size={18} className="animate-spin text-brand-600" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-brand-800 dark:text-brand-200">Module werden geladen...</p>
            <p className="text-xs text-brand-600 dark:text-brand-400">
              Dein Studiengang ({profile?.study_program} an {profile?.university}) wird automatisch importiert.
            </p>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectMode && (
        <div className="flex items-center gap-2 sm:gap-3 mb-4 p-2 sm:p-3 bg-surface-50 rounded-xl border border-surface-200 flex-wrap">
          <button
            onClick={selectAll}
            className="text-xs sm:text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300"
          >
            {selected.size === filtered.length ? t("common.cancel") : t("modules.select")}
          </button>
          <span className="text-xs text-surface-500 dark:text-surface-400">{t("modules.selected", { count: selected.size })}</span>
          <div className="flex-1" />
          <button
            onClick={handleBulkDelete}
            disabled={selected.size === 0}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Trash2 size={14} />
            {selected.size > 0 ? `${selected.size} ${t("common.delete").toLowerCase()}` : t("common.delete")}
          </button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            {s === "all" ? t("tasks.filterAll") : (s === "planned" ? t("studienplan.statusPlanned") : s === "active" ? t("studienplan.statusActive") : s === "completed" ? t("studienplan.statusCompleted") : s === "paused" ? t("timer.paused") : s)}
            {s !== "all" && (
              <span className="ml-1.5 opacity-70">
                {modules.filter(m => (m.status ?? "active") === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isPageLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 sm:h-44 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <BookOpen size={40} className="sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-surface-300 opacity-40" />
          <p className="font-medium text-surface-600 dark:text-surface-500 text-sm sm:text-base">{t("credits.noModules")}</p>
          <p className="text-xs sm:text-sm mt-1 text-surface-400 dark:text-surface-500 mb-4 sm:mb-6">{t("studienplan.noModulesHint")}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={openNew} className="btn-primary gap-2">
              <Plus size={16} /> {t("modules.moduleName")}
            </button>
          </div>
          {!profile?.active_program_id && (
            <p className="text-xs text-surface-400 mt-3">
              Tipp: Wähle im Profil deine Institution und deinen Studiengang — die Module werden automatisch importiert.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(mod => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              onEdit={openEdit}
              onDelete={handleDelete}
              selectMode={selectMode}
              isSelected={selected.has(mod.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ModuleModal
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}

      <LimitNudge current={modules.length} max={FREE_LIMITS.modules} isPro={isPro} label="Module" />

      {showUpgrade && (
        <UpgradeModal feature="unlimitedModules" onClose={() => setShowUpgrade(false)} />
      )}

      {deleteTarget && (
        <DeleteModuleModal
          moduleIds={deleteTarget.ids}
          moduleNames={deleteTarget.names}
          modules={modules}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            setSelected(new Set());
            setSelectMode(false);
            refetch();
          }}
        />
      )}

      {showRestore && (
        <RestoreModulesModal
          onClose={() => setShowRestore(false)}
          onRestored={() => {
            setShowRestore(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/** Modal that shows related data and offers "delete all" vs "module only" */
function DeleteModuleModal({ moduleIds, moduleNames, modules, onClose, onDeleted }: {
  moduleIds: string[];
  moduleNames: string[];
  modules: Module[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [counts, setCounts] = useState<{
    tasks: number; grades: number; topics: number;
    timeLogs: number; stundenplan: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch counts of related data
  useEffect(() => {
    async function load() {
      const [tasks, grades, topics, timeLogs, stundenplan] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
        supabase.from("grades").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
        supabase.from("topics").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
        supabase.from("time_logs").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
        supabase.from("stundenplan").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
      ]);
      setCounts({
        tasks: tasks.count ?? 0,
        grades: grades.count ?? 0,
        topics: topics.count ?? 0,
        timeLogs: timeLogs.count ?? 0,
        stundenplan: stundenplan.count ?? 0,
      });
    }
    load();
  }, [supabase, moduleIds]);

  const totalRelated = counts
    ? counts.tasks + counts.grades + counts.topics + counts.timeLogs + counts.stundenplan
    : 0;

  const isSingle = moduleIds.length === 1;
  const title = isSingle
    ? `„${moduleNames[0]}" löschen?`
    : `${moduleIds.length} Module löschen?`;

  // Determine which modules are institution-sourced (soft-delete) vs manual (hard-delete)
  const institutionIds = moduleIds.filter(id => modules.find(m => m.id === id)?.source === "institution");
  const manualIds = moduleIds.filter(id => modules.find(m => m.id === id)?.source !== "institution");

  async function deleteModuleOnly() {
    setDeleting(true);
    // Soft-delete institution modules (set hidden_at)
    if (institutionIds.length > 0) {
      await supabase
        .from("modules")
        .update({ hidden_at: new Date().toISOString() })
        .in("id", institutionIds);
    }
    // Hard-delete manually created modules
    for (const id of manualIds) {
      await supabase.from("modules").delete().eq("id", id);
    }
    onDeleted();
  }

  async function deleteWithAll() {
    setDeleting(true);
    // Delete related data for ALL modules
    for (const id of moduleIds) {
      await Promise.all([
        supabase.from("tasks").delete().eq("module_id", id),
        supabase.from("grades").delete().eq("module_id", id),
        supabase.from("topics").delete().eq("module_id", id),
        supabase.from("time_logs").delete().eq("module_id", id),
        supabase.from("stundenplan").delete().eq("module_id", id),
      ]);
    }
    // Soft-delete institution modules, hard-delete manual
    if (institutionIds.length > 0) {
      await supabase
        .from("modules")
        .update({ hidden_at: new Date().toISOString() })
        .in("id", institutionIds);
    }
    for (const id of manualIds) {
      await supabase.from("modules").delete().eq("id", id);
    }
    onDeleted();
  }

  const countItems: { label: string; count: number; icon: string }[] = counts ? [
    { label: "Aufgaben", count: counts.tasks, icon: "📋" },
    { label: "Noten", count: counts.grades, icon: "📊" },
    { label: "Wissensthemen", count: counts.topics, icon: "🧠" },
    { label: t("modules.timeLogs"), count: counts.timeLogs, icon: "⏱️" },
    { label: "Stundenplan", count: counts.stundenplan, icon: "📅" },
  ].filter(c => c.count > 0) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md mx-3 sm:mx-4">
        <div className="p-3 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 dark:text-white">{title}</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">{t("modules.cannotBeUndone")}</p>
            </div>
          </div>

          {/* Loading state */}
          {!counts ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-surface-400" />
              <span className="ml-2 text-sm text-surface-500">{t("modules.checkingLinked")}</span>
            </div>
          ) : totalRelated > 0 ? (
            <>
              {/* Related data summary */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 mb-4">
                <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                  {t("modules.linkedDataLabel")}
                </p>
                <div className="space-y-1">
                  {countItems.map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                      <span>{item.icon}</span>
                      <span className="font-medium">{item.count}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Two delete options */}
              <div className="space-y-2">
                <button
                  onClick={deleteWithAll}
                  disabled={deleting}
                  className="w-full flex items-center gap-3 p-2 sm:p-3 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-left transition-colors disabled:opacity-50"
                >
                  <Trash2 size={18} className="text-red-500 dark:text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300">{t("modules.deleteAll")}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {t("modules.linkedWillBeDeleted")}
                    </p>
                  </div>
                </button>

                <button
                  onClick={deleteModuleOnly}
                  disabled={deleting}
                  className="w-full flex items-center gap-3 p-2 sm:p-3 rounded-xl border-2 border-surface-200 bg-surface-50 hover:bg-surface-100 text-left transition-colors disabled:opacity-50"
                >
                  <BookOpen size={18} className="text-surface-500 dark:text-surface-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-surface-700 dark:text-surface-500">{t("modules.deleteModuleOnly")}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {t("modules.dataPreserved")}
                    </p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            /* No related data — simple delete */
            <div className="bg-surface-50 rounded-xl p-3 sm:p-4 mb-4">
              <p className="text-xs sm:text-sm text-surface-600">
                {t("modules.noLinkedData")}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 mt-4">
            <button
              onClick={onClose}
              disabled={deleting}
              className="btn-secondary flex-1 text-xs sm:text-sm"
            >
              {t("common.cancel")}
            </button>
            {counts && totalRelated === 0 && (
              <button
                onClick={deleteModuleOnly}
                disabled={deleting}
                className="flex-1 px-3 sm:px-4 py-2 rounded-xl bg-red-600 dark:bg-red-700 text-white text-xs sm:text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Löschen
              </button>
            )}
          </div>

          {/* Deleting indicator */}
          {deleting && (
            <div className="flex items-center justify-center gap-2 mt-3 text-xs sm:text-sm text-surface-500 dark:text-surface-400">
              <Loader2 size={14} className="animate-spin" />
              Wird gelöscht…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ mod, onEdit, onDelete, selectMode, isSelected, onToggleSelect }: {
  mod: Module;
  onEdit: (m: Module) => void;
  onDelete: (id: string) => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const statusCfg = STATUS_CONFIG[mod.status ?? "active"] ?? STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  return (
    <div
      className={`card hover:shadow-md transition-shadow group flex flex-col ${
        selectMode ? "cursor-pointer" : ""
      } ${isSelected ? "ring-2 ring-brand-500 bg-brand-50/30 dark:bg-brand-900/20" : ""}`}
      onClick={selectMode ? () => onToggleSelect(mod.id) : undefined}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected ? "bg-brand-600 border-brand-600" : "border-surface-300"
            }`}>
              {isSelected && <CheckCircle size={12} className="text-white" />}
            </div>
          ) : (
            <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ background: mod.color ?? "#6d28d9" }} />
          )}
          {mod.code && (
            <span className="text-[10px] font-mono bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded">
              {mod.code}
            </span>
          )}
        </div>
        {!selectMode && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(mod)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-surface-900 dark:text-white leading-snug mb-1 truncate">{mod.name}</h3>
      {mod.professor && <p className="text-xs text-surface-500 dark:text-surface-400 mb-1 truncate">{mod.professor}</p>}
      {mod.exam_date && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-1">{t("modules.examDate", { date: mod.exam_date })}</p>
      )}

      <div className="flex flex-wrap gap-1 mt-2">
        {mod.ects && <span className="badge badge-violet text-xs">{mod.ects} ECTS</span>}
        {mod.semester && <span className="badge badge-gray text-xs">{displaySemester(mod.semester)}</span>}
        {mod.module_type && mod.module_type !== "pflicht" && (
          <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">{mod.module_type}</span>
        )}
        {mod.day && <span className="badge badge-gray text-xs">{mod.day} {mod.time_start ?? ""}</span>}
        {mod.source === "institution" && (
          <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs">
            <Building2 size={10} className="mr-0.5" /> FH
          </span>
        )}
      </div>

      {/* Status + links */}
      <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3 gap-2">
        <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
          <StatusIcon size={10} />
          {statusCfg.label}
        </span>
        {!selectMode && (
          <div className="flex gap-1">
            {mod.link && (
              <a href={mod.link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
                 title="Kurslink">
                <ExternalLink size={13} />
              </a>
            )}
            {mod.github_link && (
              <a href={mod.github_link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 hover:text-surface-800 hover:bg-surface-100 transition-colors"
                 title="GitHub">
                <Github size={13} />
              </a>
            )}
            {mod.sharepoint_link && (
              <a href={mod.sharepoint_link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 dark:text-surface-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                 title="SharePoint">
                <FileText size={13} />
              </a>
            )}
            {mod.notes_link && (
              <a href={mod.notes_link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 dark:text-surface-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                 title="Notizen">
                <Link2 size={13} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleModal({ initial, onClose, onSaved }: {
  initial: Module | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [tab, setTab] = useState<"basic"|"details"|"links">("basic");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    professor: initial?.professor ?? "",
    ects: initial?.ects?.toString() ?? "",
    semester: displaySemester(initial?.semester) || "",
    day: initial?.day ?? "",
    time_start: initial?.time_start ?? "",
    time_end: initial?.time_end ?? "",
    room: initial?.room ?? "",
    color: initial?.color ?? MODULE_COLORS[0],
    notes: initial?.notes ?? "",
    // Extended fields
    status: initial?.status ?? "planned",
    module_type: initial?.module_type ?? "pflicht",
    exam_date: initial?.exam_date ?? "",
    weighting: initial?.weighting?.toString() ?? "1",
    target_grade: initial?.target_grade?.toString() ?? "",
    in_plan: initial?.in_plan ?? true,
    link: initial?.link ?? "",
    github_link: initial?.github_link ?? "",
    sharepoint_link: initial?.sharepoint_link ?? "",
    literature_links: initial?.literature_links ?? "",
    notes_link: initial?.notes_link ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | boolean) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      name: form.name,
      code: form.code || null,
      professor: form.professor || null,
      ects: form.ects ? parseInt(form.ects) : null,
      semester: form.semester || null,
      day: form.day || null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      room: form.room || null,
      color: form.color,
      notes: form.notes || null,
      status: form.status,
      module_type: form.module_type,
      exam_date: form.exam_date || null,
      weighting: form.weighting ? parseFloat(form.weighting) : 1,
      target_grade: form.target_grade ? parseFloat(form.target_grade) : null,
      in_plan: form.in_plan,
      link: form.link || null,
      github_link: form.github_link || null,
      sharepoint_link: form.sharepoint_link || null,
      literature_links: form.literature_links || null,
      notes_link: form.notes_link || null,
    };
    if (initial) {
      await supabase.from("modules").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("modules").insert({ ...payload, user_id: user.id, source: "manual" });
    }
    setSaving(false);
    onSaved();
  }

  const TABS = [
    { id: "basic",   label: "Allgemein" },
    { id: "details", label: "Details" },
    { id: "links",   label: "Links" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-3 sm:mx-4">
        <div className="flex items-center justify-between p-3 sm:p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{initial ? t("modules.moduleEdit") : t("modules.newModule")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100 px-3 sm:px-5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-2.5 px-1 mr-4 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-brand-600 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-5 space-y-3 sm:space-y-4">
          {tab === "basic" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Modulname *</label>
                  <input className="input" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="z.B. Mathematik 1" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Code</label>
                  <input className="input font-mono" value={form.code} onChange={e => set("code", e.target.value)} placeholder="MAT1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Dozent</label>
                  <input className="input" value={form.professor} onChange={e => set("professor", e.target.value)} placeholder="Prof. Muster" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">ECTS</label>
                  <input className="input" type="number" min="1" max="30" value={form.ects} onChange={e => set("ects", e.target.value)} placeholder="4" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Semester</label>
                  <select className="input" value={form.semester} onChange={e => set("semester", e.target.value)}>
                    <option value="">— wählen —</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Typ</label>
                  <select className="input" value={form.module_type} onChange={e => set("module_type", e.target.value)}>
                    {MODULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Tag</label>
                  <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                    <option value="">—</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Von</label>
                  <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Bis</label>
                  <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Zimmer</label>
                  <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="A101" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Status</label>
                  <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-2">Farbe</label>
                <div className="flex gap-2 flex-wrap">
                  {MODULE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => set("color", c)}
                      className={`w-6 sm:w-7 h-6 sm:h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 dark:border-surface-200 scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Notizen</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optionale Notizen…" />
              </div>
            </>
          )}

          {tab === "details" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">{t("modules.examDateLabel")}</label>
                  <input className="input" type="date" value={form.exam_date} onChange={e => set("exam_date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Ziel-Note</label>
                  <input className="input" type="number" min="1" max="6" step="0.1" value={form.target_grade} onChange={e => set("target_grade", e.target.value)} placeholder="5.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Gewichtung</label>
                <input className="input" type="number" min="0.1" max="10" step="0.1" value={form.weighting} onChange={e => set("weighting", e.target.value)} placeholder="1" />
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{t("modules.weightedGradeAverage")}</p>
              </div>
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-surface-50 rounded-xl">
                <input
                  type="checkbox"
                  id="in_plan"
                  checked={form.in_plan}
                  onChange={e => set("in_plan", e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <label htmlFor="in_plan" className="text-xs sm:text-sm text-surface-700 dark:text-surface-500 cursor-pointer">
                  <span className="font-medium">Im Studienplan</span>
                  <span className="text-surface-500 dark:text-surface-400 ml-1">{t("modules.semesterOverview")}</span>
                </label>
              </div>
            </>
          )}

          {tab === "links" && (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Kurslink (Moodle/FH)</label>
                <input className="input" type="url" value={form.link} onChange={e => set("link", e.target.value)} placeholder="https://moodle.ffhs.ch/course/…" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">GitHub</label>
                <input className="input" type="url" value={form.github_link} onChange={e => set("github_link", e.target.value)} placeholder="https://github.com/…" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">SharePoint / OneDrive</label>
                <input className="input" type="url" value={form.sharepoint_link} onChange={e => set("sharepoint_link", e.target.value)} placeholder="https://…sharepoint.com/…" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Notizen-Link (Notion, OneNote…)</label>
                <input className="input" type="url" value={form.notes_link} onChange={e => set("notes_link", e.target.value)} placeholder="https://notion.so/…" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-500 mb-1">Literatur-Links</label>
                <textarea className="input resize-none" rows={3} value={form.literature_links} onChange={e => set("literature_links", e.target.value)} placeholder="https://… (eine URL pro Zeile)" />
              </div>
            </>
          )}

          <div className="flex gap-2 sm:gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs sm:text-sm">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-xs sm:text-sm">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Restore Modules Modal                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function RestoreModulesModal({ onClose, onRestored }: {
  onClose: () => void;
  onRestored: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [restoring, setRestoring] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<Module[]>([]);
  const [loadingHidden, setLoadingHidden] = useState(true);
  const [manualCount, setManualCount] = useState(0);

  useEffect(() => {
    (async () => {
      // Load hidden institution modules
      const { data: hidden } = await supabase
        .from("modules")
        .select("*")
        .eq("source", "institution")
        .not("hidden_at", "is", null)
        .order("name");
      setHiddenModules((hidden ?? []) as Module[]);

      // Count manual modules that will be removed
      const { count } = await supabase
        .from("modules")
        .select("id", { count: "exact", head: true })
        .eq("source", "manual")
        .is("hidden_at", null);
      setManualCount(count ?? 0);

      setLoadingHidden(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRestore() {
    setRestoring(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRestoring(false); return; }

    // 1. Restore all hidden institution modules (clear hidden_at)
    await supabase
      .from("modules")
      .update({ hidden_at: null })
      .eq("user_id", user.id)
      .eq("source", "institution")
      .not("hidden_at", "is", null);

    // 2. Delete all manually created modules
    await supabase
      .from("modules")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "manual");

    setRestoring(false);
    onRestored();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md mx-3 sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-3 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <RotateCcw size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 dark:text-white text-sm">Module wiederherstellen</h2>
              <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400">Studiengang-Module zurücksetzen</p>
            </div>
            <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-surface-200 text-surface-400">
              <X size={16} />
            </button>
          </div>

          {loadingHidden ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-surface-400" />
            </div>
          ) : (
            <>
              {/* What will happen */}
              <div className="space-y-3 mb-5">
                {hiddenModules.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-2 sm:p-3">
                    <p className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                      <CheckCircle size={14} /> {hiddenModules.length} ausgeblendete Module werden wiederhergestellt
                    </p>
                    <div className="mt-2 space-y-0.5">
                      {hiddenModules.slice(0, 5).map(m => (
                        <p key={m.id} className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="truncate">{m.name}</span>
                        </p>
                      ))}
                      {hiddenModules.length > 5 && (
                        <p className="text-xs text-green-600 dark:text-green-500">
                          + {hiddenModules.length - 5} weitere
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {manualCount > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-2 sm:p-3">
                    <p className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
                      <AlertTriangle size={14} /> {manualCount} eigene Module werden entfernt
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Manuell erstellte Module werden gelöscht. Verknüpfte Daten (Noten, Aufgaben) bleiben erhalten.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 sm:gap-3">
                <button onClick={onClose} disabled={restoring} className="btn-secondary flex-1 text-xs sm:text-sm">
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="flex-1 px-3 sm:px-4 py-2 rounded-xl bg-amber-600 dark:bg-amber-700 text-white text-xs sm:text-sm font-medium hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {restoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Wiederherstellen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* FH Import Modal removed — modules are now auto-imported from the Academic Builder */

