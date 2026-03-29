"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { formatDate } from "@/lib/utils";
import { Plus, X, Trash2, Pencil, GraduationCap, Clock } from "lucide-react";
import type { CalendarEvent } from "@/types/database";

type Exam = CalendarEvent & { daysLeft?: number };

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const { modules } = useModules();
  const supabase = createClient();

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("event_type", "exam")
      .order("start_dt", { ascending: true });
    const now = new Date();
    setExams((data ?? []).map(e => ({
      ...e,
      daysLeft: Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  async function handleDelete(id: string) {
    if (!confirm("Prüfung löschen?")) return;
    await supabase.from("events").delete().eq("id", id);
    fetchExams();
  }

  const upcoming = exams.filter(e => (e.daysLeft ?? 0) >= 0);
  const past = exams.filter(e => (e.daysLeft ?? 0) < 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prüfungen</h1>
          <p className="text-gray-500 text-sm mt-0.5">{upcoming.length} bevorstehend · {past.length} vergangen</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> Prüfung
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          {upcoming.length === 0 && past.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch keine Prüfungen eingetragen</p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Bevorstehend</h2>
                  <div className="space-y-3">
                    {upcoming.map(exam => (
                      <ExamCard key={exam.id} exam={exam} modules={modules}
                        onEdit={e => { setEditing(e); setShowForm(true); }}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vergangen</h2>
                  <div className="space-y-3 opacity-60">
                    {past.map(exam => (
                      <ExamCard key={exam.id} exam={exam} modules={modules}
                        onEdit={e => { setEditing(e); setShowForm(true); }}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showForm && (
        <ExamModal
          initial={editing}
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchExams(); }}
        />
      )}
    </div>
  );
}

function ExamCard({ exam, modules, onEdit, onDelete }: {
  exam: Exam;
  modules: ReturnType<typeof useModules>["modules"];
  onEdit: (e: Exam) => void;
  onDelete: (id: string) => void;
}) {
  const urgent = (exam.daysLeft ?? 999) >= 0 && (exam.daysLeft ?? 999) <= 7;
  const mod = modules.find(m => exam.title.toLowerCase().includes(m.name.toLowerCase().split(" ")[0]));

  return (
    <div className={`card hover:shadow-md transition-shadow group flex items-center gap-4 ${urgent ? "border-l-4 border-l-red-400" : ""}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{ background: exam.color ?? mod?.color ?? "#6d28d9" }}>
        <GraduationCap size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{exam.title}</p>
        <div className="flex flex-wrap gap-3 mt-1">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            📅 {formatDate(exam.start_dt)}
            {" "}
            {new Date(exam.start_dt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {exam.location && <span className="text-xs text-gray-500">📍 {exam.location}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {exam.daysLeft !== undefined && exam.daysLeft >= 0 && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            exam.daysLeft === 0 ? "bg-red-100 text-red-700" :
            exam.daysLeft <= 7 ? "bg-orange-100 text-orange-700" :
            exam.daysLeft <= 30 ? "bg-yellow-100 text-yellow-700" :
            "bg-green-100 text-green-700"
          }`}>
            <Clock size={12} />
            {exam.daysLeft === 0 ? "Heute!" : `${exam.daysLeft}d`}
          </div>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(exam)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={13} /></button>
          <button onClick={() => onDelete(exam.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function ExamModal({ initial, modules, onClose, onSaved }: {
  initial: Exam | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777"];
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    date: initial?.start_dt ? initial.start_dt.split("T")[0] : "",
    time: initial?.start_dt ? initial.start_dt.split("T")[1]?.slice(0, 5) ?? "09:00" : "09:00",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    color: initial?.color ?? COLORS[2],
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      start_dt: `${form.date}T${form.time}:00`,
      location: form.location || null,
      description: form.description || null,
      color: form.color,
      event_type: "exam",
    };
    if (initial) {
      await supabase.from("events").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("events").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Prüfung bearbeiten" : "Prüfung hinzufügen"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prüfungsname *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Mathematik 1 Prüfung" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
              <input className="input" type="date" required value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
              <input className="input" type="time" value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raum / Ort</label>
            <input className="input" value={form.location} onChange={e => set("location", e.target.value)} placeholder="Prüfungsraum…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Erlaubte Hilfsmittel, etc." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
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
