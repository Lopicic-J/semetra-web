"use client";

import { useState, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Plus, GraduationCap, Calendar, Clock, X, Check, Loader2 } from "lucide-react";
import type { Module } from "@/types/database";

interface Props {
  modules: Module[];
  onCreated?: () => void;
}

/**
 * Quick exam creation inline component.
 * Minimal form: Module + Title + Date + Time → done.
 * No calendar navigation needed.
 */
function QuickExamAdd({ modules, onCreated }: Props) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");

  const activeModules = modules.filter(m => m.status === "active" || m.status === "planned");

  const handleSave = async () => {
    if (!moduleId || !title || !date) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDt = `${date}T${time}:00`;
      const endDt = new Date(new Date(startDt).getTime() + 2 * 3600000).toISOString(); // +2h default

      const { error } = await supabase.from("events").insert({
        user_id: user.id,
        title,
        event_type: "exam",
        start_dt: startDt,
        end_dt: endDt,
        module_id: moduleId,
        location: location || null,
        color: modules.find(m => m.id === moduleId)?.color ?? "#dc2626",
      });

      if (!error) {
        setSaved(true);
        onCreated?.();
        // Reset after short delay
        setTimeout(() => {
          setOpen(false);
          setSaved(false);
          setTitle("");
          setDate("");
          setTime("09:00");
          setLocation("");
          setModuleId("");
        }, 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-fill title from module name
  const handleModuleChange = (id: string) => {
    setModuleId(id);
    if (!title) {
      const mod = modules.find(m => m.id === id);
      if (mod) setTitle(`${mod.name} — Prüfung`);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800/40 transition-colors"
      >
        <GraduationCap size={13} />
        {t("exams.quickAdd") || "Prüfung eintragen"}
      </button>
    );
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
        <Check size={13} /> {t("exams.created") || "Prüfung eingetragen!"}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <GraduationCap size={14} className="text-red-500" />
          {t("exams.quickAddTitle") || "Prüfung schnell eintragen"}
        </p>
        <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-600 p-0.5">
          <X size={14} />
        </button>
      </div>

      {/* Module */}
      <select
        value={moduleId}
        onChange={e => handleModuleChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
      >
        <option value="">{t("exams.selectModule") || "Modul wählen..."}</option>
        {activeModules.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t("exams.titlePlaceholder") || "Prüfungstitel"}
        className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
      />

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
          />
        </div>
        <div className="relative">
          <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
          />
        </div>
      </div>

      {/* Location (optional) */}
      <input
        type="text"
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder={t("exams.locationPlaceholder") || "Ort (optional)"}
        className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
      />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !moduleId || !title || !date}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {saving ? (t("exams.saving") || "Wird gespeichert...") : (t("exams.save") || "Prüfung eintragen")}
      </button>
    </div>
  );
}

export default memo(QuickExamAdd);
