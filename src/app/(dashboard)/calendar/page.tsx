"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import type { CalendarEvent } from "@/types/database";

function startOfMonth(y: number, m: number) { return new Date(y, m, 1); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

export default function CalendarPage() {
  const { t } = useTranslation();
  const DOW = t("calendar.dayHeaders").split("|");
  const monthNames = t("calendar.monthNames").split("|");
  const weekdayNames = t("calendar.weekdayNames").split("|");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // YYYY-MM-DD
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const fetchEvents = useCallback(async () => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59).toISOString();
    const { data } = await supabase.from("events").select("*").gte("start_dt", from).lte("start_dt", to);
    setEvents(data ?? []);
  }, [supabase, year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  // Build calendar grid (Mon-Sun)
  const firstDay = startOfMonth(year, month);
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function eventsOnDay(d: number) {
    const ds = dateStr(d);
    return events.filter(e => e.start_dt.startsWith(ds));
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    fetchEvents();
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{t("nav.calendar")}</h1>
          <p className="text-surface-500 text-sm mt-0.5">{monthNames[month]} {year}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-surface-100 rounded-xl overflow-hidden">
            <button onClick={prev} className="px-3 py-2 hover:bg-surface-200 transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} className="px-3 py-2 text-sm font-medium hover:bg-surface-200 transition-colors">{t("calendar.today")}</button>
            <button onClick={next} className="px-3 py-2 hover:bg-surface-200 transition-colors"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => { setSelected(null); setShowForm(true); }} className="btn-primary gap-2">
            <Plus size={16} /> {t("calendar.addEvent")}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-surface-100">
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-surface-400">{d}</div>
          ))}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day !== null && dateStr(day) === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const dayEvs = day ? eventsOnDay(day) : [];
            return (
              <div key={i}
                onClick={() => day && setSelected(selected === dateStr(day) ? null : dateStr(day))}
                className={`min-h-[70px] sm:min-h-[90px] p-1 sm:p-1.5 border-b border-r border-surface-50 cursor-pointer transition-colors text-xs sm:text-sm ${day ? "hover:bg-brand-50/50" : "bg-surface-50/50"} ${selected === (day ? dateStr(day) : "") ? "bg-brand-50" : ""}`}>
                {day && (
                  <>
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? "bg-brand-600 text-white" : "text-surface-700"}`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 3).map(ev => (
                        <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white font-medium"
                          style={{ background: ev.color ?? "#6d28d9" }}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvs.length > 3 && <div className="text-[10px] text-surface-400">+{dayEvs.length - 3} {t("calendar.moreEvents")}</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="mt-4 card">
          <h3 className="font-semibold text-surface-900 mb-3">
            {(() => {
              const d = new Date(selected);
              const dayName = weekdayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];
              return `${dayName}, ${d.getDate()}. ${monthNames[d.getMonth()]}`;
            })()}
          </h3>
          {events.filter(e => e.start_dt.startsWith(selected)).length === 0 ? (
            <p className="text-sm text-surface-400">{t("calendar.noEvents")}</p>
          ) : (
            <ul className="space-y-2">
              {events.filter(e => e.start_dt.startsWith(selected)).map(ev => (
                <li key={ev.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 group">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ev.color ?? "#6d28d9" }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-800">{ev.title}</p>
                    <p className="text-xs text-surface-400">
                      {new Date(ev.start_dt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                      {ev.end_dt && ` – ${new Date(ev.end_dt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
                      {ev.location && ` · ${ev.location}`}
                    </p>
                  </div>
                  <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => { setShowForm(true); }} className="mt-3 btn-ghost gap-1.5 text-sm">
            <Plus size={14} /> {t("calendar.addAppointment")}
          </button>
        </div>
      )}

      {showForm && (
        <EventModal
          defaultDate={selected ?? ""}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchEvents(); }}
        />
      )}
    </div>
  );
}

function EventModal({ defaultDate, onClose, onSaved }: { defaultDate: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777"];
  const [form, setForm] = useState({
    title: "",
    date: defaultDate,
    time_start: "08:00",
    time_end: "10:00",
    location: "",
    description: "",
    color: COLORS[0],
    event_type: "general",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("events").insert({
      user_id: user.id,
      title: form.title,
      start_dt: `${form.date}T${form.time_start}:00`,
      end_dt: form.time_end ? `${form.date}T${form.time_end}:00` : null,
      location: form.location || null,
      description: form.description || null,
      color: form.color,
      event_type: form.event_type,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{t("calendar.modal.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.titleLabel")} *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("calendar.modal.titlePlaceholder")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.dateLabel")}</label>
              <input className="input" type="date" value={form.date} onChange={e => set("date", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.fromLabel")}</label>
              <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.toLabel")}</label>
              <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.locationLabel")}</label>
            <input className="input" value={form.location} onChange={e => set("location", e.target.value)} placeholder={t("calendar.modal.locationPlaceholder")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("calendar.modal.typeLabel")}</label>
            <select className="input" value={form.event_type} onChange={e => set("event_type", e.target.value)}>
              <option value="general">{t("calendar.modal.typeGeneral")}</option>
              <option value="exam">{t("calendar.modal.typeExam")}</option>
              <option value="lecture">{t("calendar.modal.typeLecture")}</option>
              <option value="deadline">{t("calendar.modal.typeDeadline")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("calendar.modal.colorLabel")}</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("calendar.modal.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("calendar.modal.saving") : t("calendar.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
