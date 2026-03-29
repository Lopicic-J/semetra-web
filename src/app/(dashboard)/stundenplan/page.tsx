"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { Plus, X, Trash2 } from "lucide-react";
import type { StundenplanEntry } from "@/types/database";

const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const DAYS_SHORT = ["Mo","Di","Mi","Do","Fr","Sa"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00

export default function StundenplanPage() {
  const [entries, setEntries] = useState<StundenplanEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { modules } = useModules();
  const supabase = createClient();

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase.from("stundenplan").select("*");
    setEntries(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function deleteEntry(id: string) {
    await supabase.from("stundenplan").delete().eq("id", id);
    fetchEntries();
  }

  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function getEntryStyle(entry: StundenplanEntry) {
    const start = timeToMinutes(entry.time_start);
    const end = timeToMinutes(entry.time_end);
    const gridStart = 7 * 60;
    const top = ((start - gridStart) / 60) * 56; // 56px per hour
    const height = Math.max(((end - start) / 60) * 56, 28);
    return { top, height };
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stundenplan</h1>
          <p className="text-gray-500 text-sm mt-0.5">Wöchentlicher Stundenplan</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
          <Plus size={16} /> Eintrag
        </button>
      </div>

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}>
            <div />
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-2.5 text-center text-sm font-semibold text-gray-600 border-l border-gray-100">{d}</div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative" style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}>
            {/* Hour lines */}
            {HOURS.map(h => (
              <div key={h} className="absolute w-full flex items-start" style={{ top: `${(h - 7) * 56}px`, height: "56px" }}>
                <div className="w-12 text-[10px] text-gray-400 text-right pr-2 pt-0.5 shrink-0">{h}:00</div>
                <div className="flex-1 border-t border-gray-100" />
              </div>
            ))}

            {/* Grid body with events */}
            <div className="ml-12 grid relative" style={{ gridTemplateColumns: "repeat(6, 1fr)", height: `${14 * 56}px` }}>
              {/* Column dividers */}
              {DAYS.map((_, i) => (
                <div key={i} className={`border-l border-gray-100 ${i === 0 ? "" : ""}`} />
              ))}

              {/* Entries */}
              {entries.map(entry => {
                const dayIdx = DAYS_SHORT.indexOf(entry.day);
                if (dayIdx < 0) return null;
                const { top, height } = getEntryStyle(entry);
                const mod = modules.find(m => m.id === entry.module_id);
                return (
                  <div key={entry.id}
                    className="absolute px-1 group"
                    style={{
                      left: `${(dayIdx / 6) * 100}%`,
                      width: `${(1 / 6) * 100}%`,
                      top: `${top}px`,
                      height: `${height}px`,
                      padding: "2px",
                    }}>
                    <div className="w-full h-full rounded-lg px-1.5 py-1 overflow-hidden text-white relative"
                      style={{ background: entry.color ?? mod?.color ?? "#6d28d9" }}>
                      <p className="text-[11px] font-semibold leading-tight truncate">{entry.title}</p>
                      {entry.room && <p className="text-[10px] opacity-80 truncate">{entry.room}</p>}
                      <p className="text-[10px] opacity-70">{entry.time_start} – {entry.time_end}</p>
                      <button onClick={() => deleteEntry(entry.id)}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-black/20 hover:bg-black/40">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <StundenplanModal
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchEntries(); }}
        />
      )}
    </div>
  );
}

function StundenplanModal({ modules, onClose, onSaved }: {
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const DAYS_SHORT = ["Mo","Di","Mi","Do","Fr","Sa"];
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#7c3aed"];

  const [form, setForm] = useState({
    title: "",
    day: "Mo",
    time_start: "08:00",
    time_end: "10:00",
    room: "",
    module_id: "",
    color: COLORS[0],
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("stundenplan").insert({
      title: form.title,
      day: form.day,
      time_start: form.time_start,
      time_end: form.time_end,
      room: form.room || null,
      module_id: form.module_id || null,
      color: form.color,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Neuer Eintrag</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Mathematik 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
              <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                {DAYS_SHORT.map(d => <option key={d} value={d}>{d}</option>)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Raum</label>
              <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder="A101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modul</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
            <div className="flex gap-2 flex-wrap">
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
