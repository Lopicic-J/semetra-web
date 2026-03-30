"use client";
import { useState } from "react";
import { useGrades } from "@/lib/hooks/useGrades";
import { useModules } from "@/lib/hooks/useModules";
import { createClient } from "@/lib/supabase/client";
import { formatDate, gradeAvg, gradeColor } from "@/lib/utils";
import { Plus, X, Trash2, Pencil, BarChart2 } from "lucide-react";
import type { Grade } from "@/types/database";

export default function GradesPage() {
  const { grades, loading, refetch } = useGrades();
  const { modules } = useModules();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const supabase = createClient();

  const filtered = filterModule === "all" ? grades : grades.filter(g => g.module_id === filterModule);
  const avg = gradeAvg(filtered);

  // Group by module
  const byModule = modules.map(m => ({
    module: m,
    grades: grades.filter(g => g.module_id === m.id),
  })).filter(x => x.grades.length > 0);

  async function handleDelete(id: string) {
    if (!confirm("Note löschen?")) return;
    await supabase.from("grades").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Noten</h1>
          <p className="text-gray-500 text-sm mt-0.5">{grades.length} Noten eingetragen</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> Note erfassen
        </button>
      </div>

      {/* Summary bar */}
      {grades.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className={`text-3xl font-bold ${gradeColor(avg)}`}>{avg.toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">Gesamtdurchschnitt</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-600">{Math.max(...grades.map(g => g.grade)).toFixed(1)}</p>
            <p className="text-sm text-gray-500 mt-1">Beste Note</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-red-600">{Math.min(...grades.map(g => g.grade)).toFixed(1)}</p>
            <p className="text-sm text-gray-500 mt-1">Schlechteste Note</p>
          </div>
        </div>
      )}

      {/* Module filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilterModule("all")} className={`badge cursor-pointer ${filterModule === "all" ? "bg-violet-600 text-white" : "badge-gray hover:bg-gray-200"}`}>
          Alle
        </button>
        {byModule.map(({ module: m }) => (
          <button key={m.id} onClick={() => setFilterModule(m.id)}
            className={`badge cursor-pointer ${filterModule === m.id ? "text-white" : "badge-gray hover:bg-gray-200"}`}
            style={filterModule === m.id ? { background: m.color ?? "#6d28d9" } : {}}>
            {m.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Noten erfasst</p>
        </div>
      ) : filterModule === "all" ? (
        // Grouped view
        <div className="space-y-4">
          {byModule.map(({ module: m, grades: mGrades }) => {
            const mAvg = gradeAvg(mGrades);
            return (
              <div key={m.id} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color ?? "#6d28d9" }} />
                  <span className="font-semibold text-gray-900 flex-1">{m.name}</span>
                  <span className={`text-lg font-bold ${gradeColor(mAvg)}`}>{mAvg.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {mGrades.map(g => (
                    <GradeRow key={g.id} grade={g} onEdit={e => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-gray-50">
          {filtered.map(g => (
            <GradeRow key={g.id} grade={g} onEdit={e => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showForm && (
        <GradeModal
          initial={editing}
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

function GradeRow({ grade, onEdit, onDelete }: {
  grade: Grade & { modules?: { name: string; color: string } | null };
  onEdit: (g: Grade) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{grade.title}</p>
        <p className="text-xs text-gray-400">
          {formatDate(grade.date)}
          {grade.weight && grade.weight !== 1 ? ` · Gewicht: ${grade.weight}` : ""}
          {grade.exam_type && ` · ${grade.exam_type}`}
        </p>
      </div>
      <div className={`text-xl font-bold w-14 text-right ${gradeColor(grade.grade)}`}>
        {grade.grade.toFixed(1)}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(grade)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={13} /></button>
        <button onClick={() => onDelete(grade.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function GradeModal({ initial, modules, onClose, onSaved }: {
  initial: Grade | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    grade: initial?.grade?.toString() ?? "",
    date: initial?.date ? initial.date.split("T")[0] : new Date().toISOString().split("T")[0],
    module_id: initial?.module_id ?? "",
    weight: initial?.weight?.toString() ?? "1",
    exam_type: initial?.exam_type ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const gradeNum = parseFloat(form.grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 6) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      title: form.title,
      grade: gradeNum,
      date: form.date,
      module_id: form.module_id || null,
      weight: parseFloat(form.weight) || 1,
      exam_type: form.exam_type || null,
      notes: form.notes || null,
    };
    if (initial) {
      await supabase.from("grades").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("grades").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Note bearbeiten" : "Note erfassen"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Prüfung 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note * (1–6)</label>
              <input className="input" required type="number" step="0.1" min="1" max="6" value={form.grade} onChange={e => set("grade", e.target.value)} placeholder="5.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gewicht</label>
              <input className="input" type="number" step="0.5" min="0.5" max="5" value={form.weight} onChange={e => set("weight", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input className="input" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modul</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select className="input" value={form.exam_type} onChange={e => set("exam_type", e.target.value)}>
                <option value="">—</option>
                <option value="Prüfung">Prüfung</option>
                <option value="Testat">Testat</option>
                <option value="Hausarbeit">Hausarbeit</option>
                <option value="Projekt">Projekt</option>
                <option value="Mündlich">Mündlich</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Feedback, Kommentar…" />
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
