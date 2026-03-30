"use client";
import { useState } from "react";
import { useGrades } from "@/lib/hooks/useGrades";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";
import { formatDate, gradeAvg, gradeColor } from "@/lib/utils";
import { FREE_LIMITS } from "@/lib/gates";
import { UpgradeModal } from "@/components/ui/ProGate";
import { Plus, X, Trash2, Pencil, BarChart2, TrendingUp, AlertTriangle, Award, Target } from "lucide-react";
import type { Grade, Module } from "@/types/database";

function displaySemester(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("Semester ")) return raw;
  const match = raw.match(/[HF]S?(\d+)/i);
  if (match) return `Semester ${match[1]}`;
  return raw;
}

/** Best (highest) grade per module – determines if ECTS are earned */
function bestGradeForModule(moduleId: string, grades: Grade[]): number | null {
  const mg = grades.filter(g => g.module_id === moduleId);
  if (mg.length === 0) return null;
  return Math.max(...mg.map(g => g.grade));
}

export default function GradesPage() {
  const { grades, loading, refetch } = useGrades();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const supabase = createClient();

  const filtered = filterModule === "all" ? grades : grades.filter(g => g.module_id === filterModule);
  const avg = gradeAvg(filtered);

  // ECTS calculations
  const totalEcts = modules.reduce((s, m) => s + (m.ects ?? 0), 0);
  const earnedEcts = modules.reduce((s, m) => {
    const best = bestGradeForModule(m.id, grades);
    if (best !== null && best >= 4.0) return s + (m.ects ?? 0);
    return s;
  }, 0);
  const failedModules = modules.filter(m => {
    const best = bestGradeForModule(m.id, grades);
    return best !== null && best < 4.0;
  });
  const gradedModules = modules.filter(m => bestGradeForModule(m.id, grades) !== null);
  const ungradedModules = modules.filter(m => bestGradeForModule(m.id, grades) === null);

  // Group by module with ECTS info
  const byModule = modules.map(m => {
    const mGrades = grades.filter(g => g.module_id === m.id);
    const best = mGrades.length > 0 ? Math.max(...mGrades.map(g => g.grade)) : null;
    return { module: m, grades: mGrades, bestGrade: best, passed: best !== null && best >= 4.0 };
  }).filter(x => x.grades.length > 0);

  async function handleDelete(id: string) {
    if (!confirm("Note löschen?")) return;
    await supabase.from("grades").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Noten & ECTS</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {grades.length} Noten · {earnedEcts}/{totalEcts} ECTS erlangt
            {!isPro && <span className="text-amber-600 ml-2">({grades.length}/{FREE_LIMITS.grades} Free-Limit)</span>}
          </p>
        </div>
        <button onClick={() => {
          if (!isPro && grades.length >= FREE_LIMITS.grades) {
            setShowUpgrade(true);
            return;
          }
          setEditing(null); setShowForm(true);
        }} className="btn-primary gap-2">
          <Plus size={16} /> Note erfassen
        </button>
      </div>

      {/* ECTS Progress Bar */}
      {totalEcts > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">ECTS-Fortschritt</span>
            <span className="text-sm font-bold text-violet-600">{earnedEcts} / {totalEcts} ECTS</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((earnedEcts / totalEcts) * 100, 100)}%`,
                background: earnedEcts >= totalEcts ? "#059669" : "#7c3aed",
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {Math.round((earnedEcts / totalEcts) * 100)}% abgeschlossen
            {ungradedModules.length > 0 && ` · ${ungradedModules.length} Module noch offen`}
          </p>
        </div>
      )}

      {/* Summary cards */}
      {grades.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-4">
            <TrendingUp size={18} className="mx-auto mb-1.5 text-violet-500" />
            <p className={`text-2xl font-bold ${gradeColor(avg)}`}>{avg.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Durchschnitt</p>
          </div>
          <div className="card text-center py-4">
            <Award size={18} className="mx-auto mb-1.5 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{earnedEcts}</p>
            <p className="text-xs text-gray-500 mt-0.5">ECTS erlangt</p>
          </div>
          <div className="card text-center py-4">
            <Target size={18} className="mx-auto mb-1.5 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{gradedModules.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Module bewertet</p>
          </div>
          <div className="card text-center py-4">
            <AlertTriangle size={18} className="mx-auto mb-1.5 text-red-400" />
            <p className="text-2xl font-bold text-red-600">{failedModules.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Nicht bestanden</p>
          </div>
        </div>
      )}

      {/* Warning for failed modules */}
      {failedModules.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">Achtung: {failedModules.length} Modul{failedModules.length > 1 ? "e" : ""} nicht bestanden</span>
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

      {/* Module filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilterModule("all")} className={`badge cursor-pointer ${filterModule === "all" ? "bg-violet-600 text-white" : "badge-gray hover:bg-gray-200"}`}>
          Alle
        </button>
        {byModule.map(({ module: m, passed }) => (
          <button key={m.id} onClick={() => setFilterModule(m.id)}
            className={`badge cursor-pointer ${filterModule === m.id ? "text-white" : "badge-gray hover:bg-gray-200"}`}
            style={filterModule === m.id ? { background: m.color ?? "#6d28d9" } : {}}>
            {m.name} {passed ? "✓" : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Noten erfasst</p>
          <p className="text-sm mt-1">Erfasse Noten für deine Module — ECTS werden automatisch gutgeschrieben bei Note ≥ 4.0</p>
        </div>
      ) : filterModule === "all" ? (
        // Grouped view
        <div className="space-y-4">
          {byModule.map(({ module: m, grades: mGrades, bestGrade, passed }) => {
            const mAvg = gradeAvg(mGrades);
            return (
              <div key={m.id} className={`card p-0 overflow-hidden ${!passed && bestGrade !== null ? "ring-1 ring-red-200" : ""}`}>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color ?? "#6d28d9" }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{m.name}</span>
                    {m.semester && <span className="text-xs text-gray-400 ml-2">{displaySemester(m.semester)}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {m.ects && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${passed ? "bg-green-100 text-green-700" : bestGrade !== null ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {passed ? `${m.ects} ECTS ✓` : bestGrade !== null ? `${m.ects} ECTS ✗` : `${m.ects} ECTS`}
                      </span>
                    )}
                    <span className={`text-lg font-bold ${gradeColor(mAvg)}`}>{mAvg.toFixed(2)}</span>
                  </div>
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

      {showUpgrade && (
        <UpgradeModal feature="unlimitedGrades" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}

function GradeRow({ grade, onEdit, onDelete }: {
  grade: Grade & { modules?: { name: string; color: string } | null };
  onEdit: (g: Grade) => void;
  onDelete: (id: string) => void;
}) {
  const passed = grade.grade >= 4.0;
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
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${passed ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
          {passed ? "bestanden" : "n. best."}
        </span>
        <div className={`text-xl font-bold w-14 text-right ${gradeColor(grade.grade)}`}>
          {grade.grade.toFixed(1)}
        </div>
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
  modules: Module[];
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

  const gradeNum = parseFloat(form.grade);
  const isValid = !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 6;
  const selectedModule = modules.find(m => m.id === form.module_id);
  const wouldEarnEcts = isValid && gradeNum >= 4.0 && selectedModule?.ects;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Modul *</label>
            <select className="input" required value={form.module_id} onChange={e => set("module_id", e.target.value)}>
              <option value="">— Modul wählen —</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.name} {m.ects ? `(${m.ects} ECTS)` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Schlussprüfung" />
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

          {/* ECTS Preview */}
          {isValid && selectedModule && (
            <div className={`p-3 rounded-xl text-sm ${gradeNum >= 4.0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {gradeNum >= 4.0 ? (
                <>✓ Bestanden — <strong>{selectedModule.ects} ECTS</strong> werden gutgeschrieben</>
              ) : (
                <>✗ Nicht bestanden (Note &lt; 4.0) — keine ECTS</>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
            <select className="input" value={form.exam_type} onChange={e => set("exam_type", e.target.value)}>
              <option value="">—</option>
              <option value="Schlussprüfung">Schlussprüfung</option>
              <option value="Zwischenprüfung">Zwischenprüfung</option>
              <option value="Testat">Testat</option>
              <option value="Hausarbeit">Hausarbeit</option>
              <option value="Projekt">Projekt</option>
              <option value="Mündlich">Mündlich</option>
              <option value="Online-Prüfung">Online-Prüfung</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Feedback, Kommentar…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving || !isValid} className="btn-primary flex-1 justify-center">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
