"use client";
import { useState } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { createClient } from "@/lib/supabase/client";
import { MODULE_COLORS } from "@/lib/utils";
import {
  Plus, BookOpen, Pencil, Trash2, X, ExternalLink, Github,
  FileText, Link2, CheckCircle, Clock, AlertCircle, PauseCircle
} from "lucide-react";
import type { Module } from "@/types/database";

const SEMESTERS = ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8","Semester 9"];
const DAYS = ["Mo","Di","Mi","Do","Fr","Sa"];
const MODULE_TYPES = ["pflicht","wahl","vertiefung"];
const STATUS_OPTIONS = ["planned","active","completed","paused"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  planned:   { label: "Geplant",      icon: Clock,        cls: "bg-gray-100 text-gray-600" },
  active:    { label: "Aktiv",        icon: AlertCircle,  cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Abgeschlossen",icon: CheckCircle,  cls: "bg-green-50 text-green-700" },
  paused:    { label: "Pausiert",     icon: PauseCircle,  cls: "bg-amber-50 text-amber-700" },
};

export default function ModulesPage() {
  const { modules, loading, refetch } = useModules();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const supabase = createClient();

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(m: Module) { setEditing(m); setShowForm(true); }

  async function handleDelete(id: string) {
    if (!confirm("Modul wirklich löschen?")) return;
    await supabase.from("modules").delete().eq("id", id);
    refetch();
  }

  const filtered = filter === "all" ? modules : modules.filter(m => (m.status ?? "active") === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Module</h1>
          <p className="text-gray-500 text-sm mt-0.5">{modules.length} Module · {modules.reduce((s, m) => s + (m.ects ?? 0), 0)} ECTS total</p>
        </div>
        <button onClick={openNew} className="btn-primary gap-2">
          <Plus size={16} /> Modul hinzufügen
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Keine Module gefunden</p>
          <p className="text-sm mt-1">Klicke auf „Modul hinzufügen" oder importiere via Studiengänge.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(mod => (
            <ModuleCard key={mod.id} mod={mod} onEdit={openEdit} onDelete={handleDelete} />
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
    </div>
  );
}

function ModuleCard({ mod, onEdit, onDelete }: {
  mod: Module;
  onEdit: (m: Module) => void;
  onDelete: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[mod.status ?? "active"] ?? STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="card hover:shadow-md transition-shadow group flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ background: mod.color ?? "#6d28d9" }} />
          {mod.code && (
            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {mod.code}
            </span>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(mod)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 leading-snug mb-1">{mod.name}</h3>
      {mod.professor && <p className="text-xs text-gray-500 mb-1">{mod.professor}</p>}
      {mod.exam_date && (
        <p className="text-xs text-red-500 mb-1">Prüfung: {mod.exam_date}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {mod.ects && <span className="badge badge-violet">{mod.ects} ECTS</span>}
        {mod.semester && <span className="badge badge-gray">{mod.semester}</span>}
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
        <div className="flex gap-1.5">
          {mod.link && (
            <a href={mod.link} target="_blank" rel="noreferrer"
               className="p-1 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
               title="Kurslink">
              <ExternalLink size={13} />
            </a>
          )}
          {mod.github_link && (
            <a href={mod.github_link} target="_blank" rel="noreferrer"
               className="p-1 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"
               title="GitHub">
              <Github size={13} />
            </a>
          )}
          {mod.sharepoint_link && (
            <a href={mod.sharepoint_link} target="_blank" rel="noreferrer"
               className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
               title="SharePoint">
              <FileText size={13} />
            </a>
          )}
          {mod.notes_link && (
            <a href={mod.notes_link} target="_blank" rel="noreferrer"
               className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
               title="Notizen">
              <Link2 size={13} />
            </a>
          )}
        </div>
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
    semester: initial?.semester ?? "",
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Modul bearbeiten" : "Neues Modul"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {tab === "basic" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modulname *</label>
                  <input className="input" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="z.B. Mathematik 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input className="input font-mono" value={form.code} onChange={e => set("code", e.target.value)} placeholder="MAT1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dozent</label>
                  <input className="input" value={form.professor} onChange={e => set("professor", e.target.value)} placeholder="Prof. Muster" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ECTS</label>
                  <input className="input" type="number" min="1" max="30" value={form.ects} onChange={e => set("ects", e.target.value)} placeholder="4" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select className="input" value={form.semester} onChange={e => set("semester", e.target.value)}>
                    <option value="">— wählen —</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                  <select className="input" value={form.module_type} onChange={e => set("module_type", e.target.value)}>
                    {MODULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                  <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                    <option value="">—</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                  <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                  <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zimmer</label>
                  <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="A101" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
                <div className="flex gap-2 flex-wrap">
                  {MODULE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => set("color", c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optionale Notizen…" />
              </div>
            </>
          )}

          {tab === "details" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prüfungsdatum</label>
                  <input className="input" type="date" value={form.exam_date} onChange={e => set("exam_date", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ziel-Note</label>
                  <input className="input" type="number" min="1" max="6" step="0.1" value={form.target_grade} onChange={e => set("target_grade", e.target.value)} placeholder="5.0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gewichtung</label>
                <input className="input" type="number" min="0.1" max="10" step="0.1" value={form.weighting} onChange={e => set("weighting", e.target.value)} placeholder="1" />
                <p className="text-xs text-gray-400 mt-1">Für den gewichteten Notendurchschnitt</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  id="in_plan"
                  checked={form.in_plan}
                  onChange={e => set("in_plan", e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <label htmlFor="in_plan" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">Im Studienplan</span>
                  <span className="text-gray-500 ml-1">— erscheint in der Semesterübersicht</span>
                </label>
              </div>
            </>
          )}

          {tab === "links" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kurslink (Moodle/FH)</label>
                <input className="input" type="url" value={form.link} onChange={e => set("link", e.target.value)} placeholder="https://moodle.ffhs.ch/course/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub</label>
                <input className="input" type="url" value={form.github_link} onChange={e => set("github_link", e.target.value)} placeholder="https://github.com/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SharePoint / OneDrive</label>
                <input className="input" type="url" value={form.sharepoint_link} onChange={e => set("sharepoint_link", e.target.value)} placeholder="https://…sharepoint.com/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen-Link (Notion, OneNote…)</label>
                <input className="input" type="url" value={form.notes_link} onChange={e => set("notes_link", e.target.value)} placeholder="https://notion.so/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Literatur-Links</label>
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
