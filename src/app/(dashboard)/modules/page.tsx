"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { createClient } from "@/lib/supabase/client";
import { MODULE_COLORS } from "@/lib/utils";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { UpgradeModal, LimitNudge, LimitCounter } from "@/components/ui/ProGate";
import {
  Plus, BookOpen, Pencil, Trash2, X, ExternalLink, Github,
  FileText, Link2, CheckCircle, Clock, AlertCircle, PauseCircle,
  CheckSquare, Square, XSquare, AlertTriangle, Loader2,
  GraduationCap, Building2, ChevronRight, Lock
} from "lucide-react";
import { ProGate } from "@/components/ui/ProGate";
import type { Module } from "@/types/database";
import type { Studiengang, StudiengangModuleTemplate } from "@/types/database";

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
const STATUS_OPTIONS = ["planned","active","completed","paused"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  planned:   { label: "Geplant",      icon: Clock,        cls: "bg-surface-100 text-surface-600" },
  active:    { label: "Aktiv",        icon: AlertCircle,  cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Abgeschlossen",icon: CheckCircle,  cls: "bg-green-50 text-green-700" },
  paused:    { label: "Pausiert",     icon: PauseCircle,  cls: "bg-amber-50 text-amber-700" },
};

export default function ModulesPage() {
  const { modules, loading, refetch } = useModules();
  const { isPro } = useProfile();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showFhImport, setShowFhImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; names: string[] } | null>(null);
  const supabase = createClient();

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

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-surface-900">Module</h1>
          <p className="text-surface-500 text-sm mt-0.5">
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
              {selectMode ? "Abbrechen" : "Auswählen"}
            </button>
          )}
          <button onClick={() => setShowFhImport(true)} className="btn-secondary gap-2 text-sm">
            <GraduationCap size={15} /> FH-Import
          </button>
          <button onClick={openNew} className="btn-primary gap-2">
            <Plus size={16} /> Modul hinzufügen
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-200">
          <button
            onClick={selectAll}
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {selected.size === filtered.length ? "Alle abwählen" : "Alle auswählen"}
          </button>
          <span className="text-xs text-surface-500">{selected.size} ausgewählt</span>
          <div className="flex-1" />
          <button
            onClick={handleBulkDelete}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={14} />
            {selected.size > 0 ? `${selected.size} löschen` : "Löschen"}
          </button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            {s === "all" ? "Alle" : STATUS_CONFIG[s]?.label ?? s}
            {s !== "all" && (
              <span className="ml-1.5 opacity-70">
                {modules.filter(m => (m.status ?? "active") === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen size={48} className="mx-auto mb-4 text-surface-300 opacity-40" />
          <p className="font-medium text-surface-600">Keine Module vorhanden</p>
          <p className="text-sm mt-1 text-surface-400 mb-6">Starte mit einem FH-Import oder erstelle Module manuell.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowFhImport(true)} className="btn-primary gap-2">
              <GraduationCap size={16} /> FH-Module importieren
            </button>
            <button onClick={openNew} className="btn-secondary gap-2">
              <Plus size={16} /> Manuell erstellen
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {showFhImport && (
        <FhImportModal
          isPro={isPro}
          onClose={() => setShowFhImport(false)}
          onImported={() => { setShowFhImport(false); refetch(); }}
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
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            setSelected(new Set());
            setSelectMode(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/** Modal that shows related data and offers "delete all" vs "module only" */
function DeleteModuleModal({ moduleIds, moduleNames, onClose, onDeleted }: {
  moduleIds: string[];
  moduleNames: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
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

  async function deleteModuleOnly() {
    setDeleting(true);
    for (const id of moduleIds) {
      await supabase.from("modules").delete().eq("id", id);
    }
    onDeleted();
  }

  async function deleteWithAll() {
    setDeleting(true);
    // Delete related data first, then the module
    for (const id of moduleIds) {
      await Promise.all([
        supabase.from("tasks").delete().eq("module_id", id),
        supabase.from("grades").delete().eq("module_id", id),
        supabase.from("topics").delete().eq("module_id", id),
        supabase.from("time_logs").delete().eq("module_id", id),
        supabase.from("stundenplan").delete().eq("module_id", id),
      ]);
      await supabase.from("modules").delete().eq("id", id);
    }
    onDeleted();
  }

  const countItems: { label: string; count: number; icon: string }[] = counts ? [
    { label: "Aufgaben", count: counts.tasks, icon: "📋" },
    { label: "Noten", count: counts.grades, icon: "📊" },
    { label: "Wissensthemen", count: counts.topics, icon: "🧠" },
    { label: "Zeiteinträge", count: counts.timeLogs, icon: "⏱️" },
    { label: "Stundenplan", count: counts.stundenplan, icon: "📅" },
  ].filter(c => c.count > 0) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900">{title}</h2>
              <p className="text-sm text-surface-500">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </div>
          </div>

          {/* Loading state */}
          {!counts ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-surface-400" />
              <span className="ml-2 text-sm text-surface-500">Verknüpfte Daten werden geprüft…</span>
            </div>
          ) : totalRelated > 0 ? (
            <>
              {/* Related data summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Folgende Daten sind mit {isSingle ? "diesem Modul" : "diesen Modulen"} verknüpft:
                </p>
                <div className="space-y-1.5">
                  {countItems.map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-sm text-amber-700">
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
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-left transition-colors disabled:opacity-50"
                >
                  <Trash2 size={18} className="text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">Alles löschen</p>
                    <p className="text-xs text-red-500">
                      {isSingle ? "Modul" : "Module"} und alle {totalRelated} verknüpften Einträge werden gelöscht
                    </p>
                  </div>
                </button>

                <button
                  onClick={deleteModuleOnly}
                  disabled={deleting}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-surface-200 bg-surface-50 hover:bg-surface-100 text-left transition-colors disabled:opacity-50"
                >
                  <BookOpen size={18} className="text-surface-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-surface-700">Nur {isSingle ? "Modul" : "Module"} löschen</p>
                    <p className="text-xs text-surface-500">
                      Aufgaben, Noten, Wissen etc. bleiben erhalten (ohne Modulzuordnung)
                    </p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            /* No related data — simple delete */
            <div className="bg-surface-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-surface-600">
                Keine verknüpften Daten vorhanden. {isSingle ? "Das Modul" : "Die Module"} kann sicher gelöscht werden.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              disabled={deleting}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
            {counts && totalRelated === 0 && (
              <button
                onClick={deleteModuleOnly}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Löschen
              </button>
            )}
          </div>

          {/* Deleting indicator */}
          {deleting && (
            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-surface-500">
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
  const statusCfg = STATUS_CONFIG[mod.status ?? "active"] ?? STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  return (
    <div
      className={`card hover:shadow-md transition-shadow group flex flex-col ${
        selectMode ? "cursor-pointer" : ""
      } ${isSelected ? "ring-2 ring-brand-500 bg-brand-50/30" : ""}`}
      onClick={selectMode ? () => onToggleSelect(mod.id) : undefined}
    >
      <div className="flex items-start justify-between mb-3">
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
            <button onClick={() => onDelete(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-surface-900 leading-snug mb-1">{mod.name}</h3>
      {mod.professor && <p className="text-xs text-surface-500 mb-1">{mod.professor}</p>}
      {mod.exam_date && (
        <p className="text-xs text-red-500 mb-1">Prüfung: {mod.exam_date}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {mod.ects && <span className="badge badge-violet">{mod.ects} ECTS</span>}
        {mod.semester && <span className="badge badge-gray">{displaySemester(mod.semester)}</span>}
        {mod.module_type && mod.module_type !== "pflicht" && (
          <span className="badge bg-amber-50 text-amber-700">{mod.module_type}</span>
        )}
        {mod.day && <span className="badge badge-gray">{mod.day} {mod.time_start ?? ""}</span>}
      </div>

      {/* Status + links */}
      <div className="flex items-center justify-between mt-auto pt-3">
        <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
          <StatusIcon size={10} />
          {statusCfg.label}
        </span>
        {!selectMode && (
          <div className="flex gap-1.5">
            {mod.link && (
              <a href={mod.link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
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
                 className="p-1 rounded text-surface-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                 title="SharePoint">
                <FileText size={13} />
              </a>
            )}
            {mod.notes_link && (
              <a href={mod.notes_link} target="_blank" rel="noreferrer"
                 className="p-1 rounded text-surface-400 hover:text-green-600 hover:bg-green-50 transition-colors"
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
      await supabase.from("modules").insert({ ...payload, user_id: user.id });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{initial ? "Modul bearbeiten" : "Neues Modul"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100 px-4 sm:px-5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-surface-500 hover:text-surface-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {tab === "basic" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-surface-700 mb-1">Modulname *</label>
                  <input className="input" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="z.B. Mathematik 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Code</label>
                  <input className="input font-mono" value={form.code} onChange={e => set("code", e.target.value)} placeholder="MAT1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Dozent</label>
                  <input className="input" value={form.professor} onChange={e => set("professor", e.target.value)} placeholder="Prof. Muster" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">ECTS</label>
                  <input className="input" type="number" min="1" max="30" value={form.ects} onChange={e => set("ects", e.target.value)} placeholder="4" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Semester</label>
                  <select className="input" value={form.semester} onChange={e => set("semester", e.target.value)}>
                    <option value="">— wählen —</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Typ</label>
                  <select className="input" value={form.module_type} onChange={e => set("module_type", e.target.value)}>
                    {MODULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Tag</label>
                  <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                    <option value="">—</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Von</label>
                  <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Bis</label>
                  <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Zimmer</label>
                  <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="A101" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                  <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">Farbe</label>
                <div className="flex gap-2 flex-wrap">
                  {MODULE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => set("color", c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Notizen</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optionale Notizen…" />
              </div>
            </>
          )}

          {tab === "details" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Prüfungsdatum</label>
                  <input className="input" type="date" value={form.exam_date} onChange={e => set("exam_date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Ziel-Note</label>
                  <input className="input" type="number" min="1" max="6" step="0.1" value={form.target_grade} onChange={e => set("target_grade", e.target.value)} placeholder="5.0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Gewichtung</label>
                <input className="input" type="number" min="0.1" max="10" step="0.1" value={form.weighting} onChange={e => set("weighting", e.target.value)} placeholder="1" />
                <p className="text-xs text-surface-400 mt-1">Für den gewichteten Notendurchschnitt</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
                <input
                  type="checkbox"
                  id="in_plan"
                  checked={form.in_plan}
                  onChange={e => set("in_plan", e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <label htmlFor="in_plan" className="text-sm text-surface-700 cursor-pointer">
                  <span className="font-medium">Im Studienplan</span>
                  <span className="text-surface-500 ml-1">— erscheint in der Semesterübersicht</span>
                </label>
              </div>
            </>
          )}

          {tab === "links" && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Kurslink (Moodle/FH)</label>
                <input className="input" type="url" value={form.link} onChange={e => set("link", e.target.value)} placeholder="https://moodle.ffhs.ch/course/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">GitHub</label>
                <input className="input" type="url" value={form.github_link} onChange={e => set("github_link", e.target.value)} placeholder="https://github.com/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">SharePoint / OneDrive</label>
                <input className="input" type="url" value={form.sharepoint_link} onChange={e => set("sharepoint_link", e.target.value)} placeholder="https://…sharepoint.com/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Notizen-Link (Notion, OneNote…)</label>
                <input className="input" type="url" value={form.notes_link} onChange={e => set("notes_link", e.target.value)} placeholder="https://notion.so/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Literatur-Links</label>
                <textarea className="input resize-none" rows={3} value={form.literature_links} onChange={e => set("literature_links", e.target.value)} placeholder="https://… (eine URL pro Zeile)" />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* FH Import Modal                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

const FH_INFO: Record<string, { full: string; color: string; country: string }> = {
  // Schweiz
  "FFHS":   { full: "Fernfachhochschule Schweiz",                       color: "#6d28d9", country: "CH" },
  "ZHAW":   { full: "Zürcher Hochschule für Angewandte Wissenschaften", color: "#2563eb", country: "CH" },
  "FHNW":   { full: "Fachhochschule Nordwestschweiz",                   color: "#dc2626", country: "CH" },
  "BFH":    { full: "Berner Fachhochschule",                            color: "#059669", country: "CH" },
  "OST":    { full: "Ostschweizer Fachhochschule",                      color: "#d97706", country: "CH" },
  "HES-SO": { full: "Haute École Spécialisée de Suisse Occidentale",    color: "#0891b2", country: "CH" },
  "HSLU":   { full: "Hochschule Luzern",                                color: "#7c3aed", country: "CH" },
  "FHGR":   { full: "Fachhochschule Graubünden",                        color: "#0d9488", country: "CH" },
  "SUPSI":  { full: "Scuola Universitaria della Svizzera Italiana",     color: "#ea580c", country: "CH" },
  // Deutschland
  "TH Köln":     { full: "Technische Hochschule Köln",                  color: "#e11d48", country: "DE" },
  "HAW Hamburg":  { full: "Hochschule für Angewandte Wissenschaften Hamburg", color: "#1d4ed8", country: "DE" },
  "DHBW":         { full: "Duale Hochschule Baden-Württemberg",         color: "#b91c1c", country: "DE" },
  "FH Aachen":    { full: "Fachhochschule Aachen",                      color: "#15803d", country: "DE" },
  // Österreich
  "FH Technikum Wien": { full: "FH Technikum Wien",                     color: "#7c2d12", country: "AT" },
  "FH Campus Wien":    { full: "FH Campus Wien",                        color: "#4338ca", country: "AT" },
  "FH Joanneum":       { full: "FH Joanneum Graz",                      color: "#0f766e", country: "AT" },
  // Frankreich
  "IUT Paris":   { full: "Institut Universitaire de Technologie Paris",  color: "#1e40af", country: "FR" },
  "INSA Lyon":   { full: "Institut National des Sciences Appliquées Lyon", color: "#9f1239", country: "FR" },
  "École 42":    { full: "École 42 Paris",                               color: "#171717", country: "FR" },
  // Italien
  "Politecnico di Milano": { full: "Politecnico di Milano",             color: "#1e3a5f", country: "IT" },
  "Sapienza Roma":         { full: "Sapienza Università di Roma",       color: "#7f1d1d", country: "IT" },
  "Università di Bologna": { full: "Alma Mater Studiorum Bologna",     color: "#92400e", country: "IT" },
  // Niederlande
  "HvA Amsterdam": { full: "Hogeschool van Amsterdam",                  color: "#ea580c", country: "NL" },
  "Fontys":        { full: "Fontys Hogescholen",                        color: "#7c3aed", country: "NL" },
  // Spanien
  "UPM Madrid":   { full: "Universidad Politécnica de Madrid",          color: "#1e3a5f", country: "ES" },
  "UPC Barcelona": { full: "Universitat Politècnica de Catalunya",      color: "#0369a1", country: "ES" },
  // UK
  "Imperial College":          { full: "Imperial College London",       color: "#1e3a5f", country: "UK" },
  "University of Manchester":  { full: "University of Manchester",      color: "#7c2d12", country: "UK" },
};

const COUNTRY_TABS: { code: string; flag: string; label: string }[] = [
  { code: "CH", flag: "🇨🇭", label: "Schweiz" },
  { code: "DE", flag: "🇩🇪", label: "Deutschland" },
  { code: "AT", flag: "🇦🇹", label: "Österreich" },
  { code: "FR", flag: "🇫🇷", label: "France" },
  { code: "IT", flag: "🇮🇹", label: "Italia" },
  { code: "NL", flag: "🇳🇱", label: "Nederland" },
  { code: "ES", flag: "🇪🇸", label: "España" },
  { code: "UK", flag: "🇬🇧", label: "UK" },
];

function FhImportModal({ isPro, onClose, onImported }: {
  isPro: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = createClient();
  const gs = useGradingSystem();
  const [programmes, setProgrammes] = useState<Studiengang[]>([]);
  const [selected, setSelected] = useState<Studiengang | null>(null);
  const [importing, setImporting] = useState(false);
  const [customSemester, setCustomSemester] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"choose" | "preview" | "done">("choose");
  const [activeFh, setActiveFh] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>(gs.country);

  useEffect(() => {
    supabase.from("studiengaenge").select("*").order("fh").order("name")
      .then(({ data }) => setProgrammes(data ?? []));
  }, [supabase]);

  // Filter by country first, then group by FH
  const countryProgrammes = useMemo(() =>
    programmes.filter(p => (p.country ?? "CH") === activeCountry),
    [programmes, activeCountry]
  );

  const fhList = useMemo(() => {
    const map = new Map<string, Studiengang[]>();
    for (const p of countryProgrammes) {
      if (!map.has(p.fh)) map.set(p.fh, []);
      map.get(p.fh)!.push(p);
    }
    return Array.from(map.entries());
  }, [countryProgrammes]);

  const visibleFhs = activeFh ? fhList.filter(([fh]) => fh === activeFh) : fhList;

  function normalizeSemester(raw: string, semCount: number): string {
    const match = raw.match(/[HF]S?(\d+)/i);
    if (match) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= semCount) return `Semester ${n}`;
    }
    if (raw.startsWith("Semester ")) return raw;
    return `Semester 1`;
  }

  function pickProgram(p: Studiengang) {
    setSelected(p);
    const init: Record<string, string> = {};
    const semCount = p.semester_count ?? 6;
    (p.modules_json ?? []).forEach((m: StudiengangModuleTemplate, i: number) => {
      init[i] = normalizeSemester(m.semester, semCount);
    });
    setCustomSemester(init);
    setStep("preview");
  }

  const maxImport = isPro ? Infinity : FREE_LIMITS.modules;

  async function doImport() {
    if (!selected?.modules_json) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }
    const modulesToImport = isPro ? selected.modules_json : selected.modules_json.slice(0, FREE_LIMITS.modules);
    const rows = modulesToImport.map((m: StudiengangModuleTemplate, i: number) => ({
      user_id: user.id,
      name: m.name,
      code: m.code,
      ects: m.ects,
      semester: customSemester[i] ?? m.semester,
      module_type: m.module_type,
      color: m.color,
      status: "planned",
      in_plan: true,
    }));
    await supabase.from("modules").insert(rows);
    setImporting(false);
    setStep("done");
  }

  const semesterCount = selected?.semester_count ?? 6;
  const SEMESTER_OPTIONS = Array.from({ length: semesterCount }, (_, i) => `Semester ${i + 1}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <GraduationCap size={18} className="text-brand-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900">Studiengang importieren</h2>
              <p className="text-xs text-surface-500">Wähle dein Land, deine Hochschule und deinen Studiengang</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400"><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {step === "choose" ? (
            <>
              {/* Country Tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-surface-100">
                {COUNTRY_TABS.map(ct => (
                  <button
                    key={ct.code}
                    onClick={() => { setActiveCountry(ct.code); setActiveFh(null); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeCountry === ct.code
                        ? "bg-brand-600 text-white"
                        : "bg-surface-50 text-surface-600 hover:bg-surface-100"
                    }`}
                  >
                    {ct.flag} {ct.label}
                  </button>
                ))}
              </div>

              {/* FH Filter Chips */}
              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => setActiveFh(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeFh === null ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  Alle ({countryProgrammes.length})
                </button>
                {fhList.map(([fh, progs]) => (
                  <button
                    key={fh}
                    onClick={() => setActiveFh(activeFh === fh ? null : fh)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeFh === fh ? "text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                    }`}
                    style={activeFh === fh ? { background: FH_INFO[fh]?.color ?? "#6d28d9" } : undefined}
                  >
                    {fh} ({progs.length})
                  </button>
                ))}
              </div>

              {/* FH Groups */}
              <div className="space-y-6">
                {visibleFhs.map(([fh, progs]) => (
                  <div key={fh}>
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: FH_INFO[fh]?.color ?? "#6d28d9" }}
                      >
                        <Building2 size={14} />
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 text-sm">{fh}</p>
                        <p className="text-xs text-surface-400">{FH_INFO[fh]?.full ?? fh}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {progs.map(p => (
                        <button
                          key={p.id}
                          onClick={() => pickProgram(p)}
                          className="bg-white border border-surface-200 rounded-xl p-3 text-left hover:border-brand-300 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${FH_INFO[fh]?.color ?? "#6d28d9"}12` }}
                            >
                              <BookOpen style={{ color: FH_INFO[fh]?.color ?? "#6d28d9" }} size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-surface-900 text-sm truncate">{p.name}</p>
                              <p className="text-xs text-surface-500">{p.abschluss} · {p.semester_count} Sem. · {p.ects_total} {gs.creditLabel} · {(p.modules_json ?? []).length} Module</p>
                            </div>
                            <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-500 shrink-0 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {programmes.length === 0 && (
                <div className="text-center py-8 text-surface-400">
                  <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Studiengänge werden geladen…</p>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-surface-400 mt-5 leading-relaxed">
                Kein offizielles Angebot der genannten Hochschulen. Basiert auf öffentlich zugänglichen Informationen.
                Verbindlich sind die Angaben der jeweiligen Institution.
              </p>
            </>
          ) : step === "preview" && selected ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setStep("choose")} className="btn-ghost text-sm gap-1 shrink-0">
                  <ChevronRight size={14} className="rotate-180" /> Zurück
                </button>
                <div className="min-w-0">
                  <h3 className="font-semibold text-surface-800 text-sm truncate">{selected.name}</h3>
                  <p className="text-xs text-surface-500">{selected.fh} · {selected.abschluss} · {selected.semester_count} Semester</p>
                </div>
              </div>

              {/* Module table */}
              <div className="border border-surface-200 rounded-xl overflow-hidden mb-4">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-surface-50 text-[10px] sm:text-xs font-semibold text-surface-500 border-b border-surface-100">
                  <div className="col-span-5 sm:col-span-4">Modul</div>
                  <div className="col-span-2 hidden sm:block">Code</div>
                  <div className="col-span-2">{gs.creditLabel}</div>
                  <div className="col-span-2 hidden sm:block">Typ</div>
                  <div className="col-span-3 sm:col-span-2">Semester</div>
                </div>
                <div className="divide-y divide-surface-50 max-h-[40vh] overflow-y-auto">
                  {(selected.modules_json ?? []).map((m: StudiengangModuleTemplate, i: number) => {
                    const locked = !isPro && i >= FREE_LIMITS.modules;
                    return (
                    <div key={i} className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center ${locked ? "opacity-40" : "hover:bg-surface-50/50"}`}>
                      <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5">
                        {locked ? <Lock size={10} className="text-surface-400 shrink-0" /> : <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />}
                        <span className="text-xs sm:text-sm font-medium text-surface-800 truncate">{m.name}</span>
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        <span className="text-[10px] font-mono bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">{m.code}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-surface-600">{m.ects}</span>
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.module_type === "pflicht" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {m.module_type}
                        </span>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        {locked ? (
                          <span className="text-[10px] text-surface-400">Pro</span>
                        ) : (
                        <select
                          className="input py-0.5 text-[10px] sm:text-xs"
                          value={customSemester[i] ?? m.semester}
                          onChange={e => setCustomSemester(s => ({ ...s, [i]: e.target.value }))}
                        >
                          {SEMESTER_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {!isPro && (selected.modules_json ?? []).length > FREE_LIMITS.modules && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <Lock size={14} className="text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800">
                    Im Free-Plan werden die ersten <strong>{FREE_LIMITS.modules} Module</strong> importiert.
                    Mit Pro erhältst du alle {(selected.modules_json ?? []).length} Module.
                  </p>
                  <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap ml-auto">Upgrade →</a>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-surface-500">
                  {isPro
                    ? `${(selected.modules_json ?? []).length} Module · ${selected.ects_total} ${gs.creditLabel}`
                    : `${Math.min((selected.modules_json ?? []).length, FREE_LIMITS.modules)} von ${(selected.modules_json ?? []).length} Modulen`
                  }
                </p>
                <button
                  onClick={doImport}
                  disabled={importing}
                  className="btn-primary gap-2"
                >
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {importing ? "Importiere…" : "Importieren"}
                </button>
              </div>
            </>
          ) : step === "done" ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={28} />
              </div>
              <h3 className="text-lg font-bold text-surface-900 mb-1">Import erfolgreich!</h3>
              <p className="text-sm text-surface-500 mb-6">
                Alle Module von <strong>{selected?.name}</strong> ({selected?.fh}) wurden importiert.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setStep("choose"); setSelected(null); }} className="btn-secondary">
                  Weiteren Studiengang
                </button>
                <button onClick={onImported} className="btn-primary">
                  Fertig
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
