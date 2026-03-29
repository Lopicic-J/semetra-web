"use client";
import { useState } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { createClient } from "@/lib/supabase/client";
import { MODULE_COLORS } from "@/lib/utils";
import { Plus, BookOpen, Pencil, Trash2, X } from "lucide-react";
import type { Module } from "@/types/database";

const SEMESTERS = ["HS24","FS25","HS25","FS26","HS26","FS27"];
const DAYS = ["Mo","Di","Mi","Do","Fr","Sa"];

export default function ModulesPage() {
  const { modules, loading, refetch } = useModules();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const supabase = createClient();

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(m: Module) { setEditing(m); setShowForm(true); }

  async function handleDelete(id: string) {
    if (!confirm("Modul wirklich löschen?")) return;
    await supabase.from("modules").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Module</h1>
          <p className="text-gray-500 text-sm mt-0.5">{modules.length} Module eingetragen</p>
        </div>
        <button onClick={openNew} className="btn-primary gap-2">
          <Plus size={16} /> Modul hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : modules.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Module</p>
          <p className="text-sm mt-1">Klicke auf „Modul hinzufügen" um zu starten.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(mod => (
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

function ModuleCard({ mod, onEdit, onDelete }: { mod: Module; onEdit: (m: Module) => void; onDelete: (id: string) => void }) {
  return (
    <div className="card hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-3 h-3 rounded-full mt-1" style={{ background: mod.color ?? "#6d28d9" }} />
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
      {mod.professor && <p className="text-xs text-gray-500 mb-3">{mod.professor}</p>}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {mod.ects && <span className="badge badge-violet">{mod.ects} ECTS</span>}
        {mod.semester && <span className="badge badge-gray">{mod.semester}</span>}
        {mod.day && <span className="badge badge-gray">{mod.day} {mod.time_start ?? ""}</span>}
        {mod.room && <span className="badge badge-gray">{mod.room}</span>}
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
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    professor: initial?.professor ?? "",
    ects: initial?.ects?.toString() ?? "",
    semester: initial?.semester ?? "",
    day: initial?.day ?? "",
    time_start: initial?.time_start ?? "",
    time_end: initial?.time_end ?? "",
    room: initial?.room ?? "",
    color: initial?.color ?? MODULE_COLORS[0],
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      professor: form.professor || null,
      ects: form.ects ? parseInt(form.ects) : null,
      semester: form.semester || null,
      day: form.day || null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      room: form.room || null,
      color: form.color,
      notes: form.notes || null,
    };
    if (initial) {
      await supabase.from("modules").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("modules").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Modul bearbeiten" : "Neues Modul"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modulname *</label>
            <input className="input" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="z.B. Mathematik 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dozent</label>
              <input className="input" value={form.professor} onChange={e => set("professor", e.target.value)} placeholder="Prof. Muster" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ECTS</label>
              <input className="input" type="number" min="1" max="30" value={form.ects} onChange={e => set("ects", e.target.value)} placeholder="6" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
              <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                <option value="">—</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
              <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
              <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zimmer</label>
              <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="A101" />
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
