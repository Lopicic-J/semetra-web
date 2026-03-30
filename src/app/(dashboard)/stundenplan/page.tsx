"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS } from "@/lib/gates";
import { UpgradeModal } from "@/components/ui/ProGate";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { StundenplanEntry } from "@/types/database";

const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const DAYS_SHORT = ["Mo","Di","Mi","Do","Fr","Sa"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00
const SEMESTERS = ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8","Semester 9"];
const MAX_KW = 20;

export default function StundenplanPage() {
  const [entries, setEntries] = useState<StundenplanEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentKw, setCurrentKw] = useState(1);
  const [currentSemester, setCurrentSemester] = useState("Semester 1");
  const { modules } = useModules();
  const { isPro } = useProfile();
  const supabase = createClient();

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase.from("stundenplan").select("*");
    setEntries(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Filter entries by current KW + semester
  const currentEntries = entries.filter(e =>
    (e.kw === currentKw || e.kw === null || e.kw === undefined) &&
    (e.semester === currentSemester || !e.semester)
  );

  // Find which KWs have entries for current semester
  const kwsWithEntries = new Set(
    entries.filter(e => e.semester === currentSemester || !e.semester).map(e => e.kw ?? 1)
  );

  async function deleteEntry(id: string) {
    await supabase.from("stundenplan").delete().eq("id", id);
    fetchEntries();
  }

  async function copyToKw(targetKw: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const toCopy = currentEntries.map(e => ({
      user_id: user.id,
      title: e.title,
      day: e.day,
      time_start: e.time_start,
      time_end: e.time_end,
      room: e.room ?? null,
      module_id: e.module_id ?? null,
      color: e.color ?? null,
      kw: targetKw,
      semester: currentSemester,
    }));
    if (toCopy.length === 0) return;
    await supabase.from("stundenplan").insert(toCopy);
    fetchEntries();
    setCurrentKw(targetKw);
  }

  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function getEntryStyle(entry: StundenplanEntry) {
    const start = timeToMinutes(entry.time_start);
    const end = timeToMinutes(entry.time_end);
    const gridStart = 7 * 60;
    const top = ((start - gridStart) / 60) * 56;
    const height = Math.max(((end - start) / 60) * 56, 28);
    return { top, height };
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Stundenplan</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Wochenplan nach Kalenderwoche & Semester
            {!isPro && <span className="text-amber-600 ml-2">({entries.length}/{FREE_LIMITS.stundenplanEntries} Einträge im Free-Plan)</span>}
          </p>
        </div>
        <button onClick={() => {
          if (!isPro && entries.length >= FREE_LIMITS.stundenplanEntries) {
            setShowUpgrade(true);
            return;
          }
          setShowForm(true);
        }} className="btn-primary gap-2">
          <Plus size={16} /> Eintrag
        </button>
      </div>

      {/* Semester selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {SEMESTERS.map(s => (
          <button
            key={s}
            onClick={() => { setCurrentSemester(s); setCurrentKw(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentSemester === s
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* KW navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setCurrentKw(Math.max(1, currentKw - 1))}
          disabled={currentKw <= 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
          {Array.from({ length: MAX_KW }, (_, i) => i + 1).map(kw => (
            <button
              key={kw}
              onClick={() => setCurrentKw(kw)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                currentKw === kw
                  ? "bg-violet-600 text-white"
                  : kwsWithEntries.has(kw)
                    ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              KW{kw}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentKw(Math.min(MAX_KW, currentKw + 1))}
          disabled={currentKw >= MAX_KW}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>

        {/* Copy to next KW */}
        {currentEntries.length > 0 && (
          <button
            onClick={() => {
              const target = currentKw + 1;
              if (target <= MAX_KW && confirm(`Alle Einträge von KW${currentKw} nach KW${target} kopieren?`)) {
                copyToKw(target);
              }
            }}
            className="btn-secondary gap-1.5 text-xs ml-2"
            title="Einträge in nächste KW kopieren"
          >
            <Copy size={13} /> → KW{Math.min(currentKw + 1, MAX_KW)}
          </button>
        )}
      </div>

      {/* Week grid */}
      <div className="card p-0 overflow-hidden overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}>
            <div className="py-2 text-center text-[10px] font-medium text-gray-400">KW{currentKw}</div>
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-2.5 text-center text-sm font-semibold text-gray-600 border-l border-gray-100">{d}</div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative">
            {HOURS.map(h => (
              <div key={h} className="absolute w-full flex items-start" style={{ top: `${(h - 7) * 56}px`, height: "56px" }}>
                <div className="w-12 text-[10px] text-gray-400 text-right pr-2 pt-0.5 shrink-0">{h}:00</div>
                <div className="flex-1 border-t border-gray-100" />
              </div>
            ))}

            <div className="ml-12 grid relative" style={{ gridTemplateColumns: "repeat(6, 1fr)", height: `${14 * 56}px` }}>
              {DAYS.map((_, i) => (
                <div key={i} className="border-l border-gray-100" />
              ))}

              {currentEntries.map(entry => {
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

      {currentEntries.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-4">
          Keine Einträge für KW{currentKw} in {currentSemester}. Erstelle neue oder kopiere aus einer anderen KW.
        </p>
      )}

      {showForm && (
        <StundenplanModal
          modules={modules}
          currentKw={currentKw}
          currentSemester={currentSemester}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchEntries(); }}
        />
      )}

      {showUpgrade && (
        <UpgradeModal feature="unlimitedPlan" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}

function StundenplanModal({ modules, currentKw, currentSemester, onClose, onSaved }: {
  modules: ReturnType<typeof useModules>["modules"];
  currentKw: number;
  currentSemester: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#7c3aed"];

  const [form, setForm] = useState({
    title: "",
    day: "Mo",
    time_start: "08:00",
    time_end: "10:00",
    room: "",
    module_id: "",
    color: COLORS[0],
    kw_from: currentKw.toString(),
    kw_to: currentKw.toString(),
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const kwFrom = parseInt(form.kw_from);
    const kwTo = parseInt(form.kw_to);
    const rows = [];

    for (let kw = kwFrom; kw <= kwTo; kw++) {
      rows.push({
        user_id: user.id,
        title: form.title,
        day: form.day,
        time_start: form.time_start,
        time_end: form.time_end,
        room: form.room || null,
        module_id: form.module_id || null,
        color: form.color,
        kw,
        semester: currentSemester,
      });
    }

    await supabase.from("stundenplan").insert(rows);
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

          {/* KW range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von KW</label>
              <input className="input" type="number" min="1" max={MAX_KW} value={form.kw_from} onChange={e => set("kw_from", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis KW</label>
              <input className="input" type="number" min={form.kw_from} max={MAX_KW} value={form.kw_to} onChange={e => set("kw_to", e.target.value)} />
            </div>
          </div>
          {parseInt(form.kw_to) > parseInt(form.kw_from) && (
            <p className="text-xs text-violet-600 -mt-2">
              Wird in {parseInt(form.kw_to) - parseInt(form.kw_from) + 1} Wochen erstellt (KW{form.kw_from}–KW{form.kw_to})
            </p>
          )}

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
