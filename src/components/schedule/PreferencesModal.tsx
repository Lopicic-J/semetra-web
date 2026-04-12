"use client";
import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import {
  Clock,
  Zap,
  Timer,
  Settings2,
  Save,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { SchedulePreferences } from "@/lib/schedule";
import { DEFAULT_PREFERENCES } from "@/lib/schedule";

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  preferences: SchedulePreferences;
  onSave: (updates: Partial<SchedulePreferences>) => Promise<void>;
}

type Tab = "time" | "energy" | "automation" | "pomodoro";

const TABS: { id: Tab; label: string; icon: typeof Clock }[] = [
  { id: "time", label: "Zeiten", icon: Clock },
  { id: "energy", label: "Energie", icon: Zap },
  { id: "automation", label: "Automatik", icon: Settings2 },
  { id: "pomodoro", label: "Pomodoro", icon: Timer },
];

function EnergyBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const labels = ["Sehr tief", "Tief", "Mittel", "Hoch", "Sehr hoch"];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-surface-700">{label}</span>
        <span className="text-xs text-surface-500">{labels[value - 1]}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 rounded-full bg-surface-200 peer-checked:bg-brand-500 transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white dark:bg-surface-800 shadow-sm transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <span className="text-sm font-medium text-surface-700">{label}</span>
        {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

export function PreferencesModal({ open, onClose, preferences, onSave }: PreferencesModalProps) {
  const [tab, setTab] = useState<Tab>("time");
  const [draft, setDraft] = useState<SchedulePreferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(preferences);
      setError(null);
    }
  }, [open, preferences]);

  const update = useCallback(<K extends keyof SchedulePreferences>(key: K, value: SchedulePreferences[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Only send changed fields
      const changes: Partial<SchedulePreferences> = {};
      for (const key of Object.keys(draft) as (keyof SchedulePreferences)[]) {
        if (key === "user_id") continue;
        if (draft[key] !== preferences[key]) {
          (changes as any)[key] = draft[key];
        }
      }
      if (Object.keys(changes).length > 0) {
        await onSave(changes);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [draft, preferences, onSave, onClose]);

  const resetToDefaults = () => {
    setDraft({ ...DEFAULT_PREFERENCES, user_id: draft.user_id });
  };

  const renderTimeTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Aufstehzeit</label>
          <input type="time" value={draft.wake_time} onChange={(e) => update("wake_time", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Schlafenszeit</label>
          <input type="time" value={draft.sleep_time} onChange={(e) => update("sleep_time", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Lernzeit ab</label>
          <input type="time" value={draft.available_from} onChange={(e) => update("available_from", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Lernzeit bis</label>
          <input type="time" value={draft.available_until} onChange={(e) => update("available_until", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Min. Lernblock: {draft.min_study_block_minutes} min
        </label>
        <input type="range" min={10} max={60} step={5} value={draft.min_study_block_minutes}
          onChange={(e) => update("min_study_block_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Max. Lernblock: {draft.max_study_block_minutes} min
        </label>
        <input type="range" min={30} max={180} step={10} value={draft.max_study_block_minutes}
          onChange={(e) => update("max_study_block_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Pause: {draft.preferred_break_minutes} min
        </label>
        <input type="range" min={5} max={30} step={5} value={draft.preferred_break_minutes}
          onChange={(e) => update("preferred_break_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Max. Lernzeit/Tag: {Math.round(draft.max_daily_study_minutes / 60)}h {draft.max_daily_study_minutes % 60}min
        </label>
        <input type="range" min={60} max={720} step={30} value={draft.max_daily_study_minutes}
          onChange={(e) => update("max_daily_study_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>

      <Toggle label="Wochenende lernen" description="Auch Sa/So für Lernblöcke nutzen"
        checked={draft.allow_weekend_study} onChange={(v) => update("allow_weekend_study", v)} />

      {draft.allow_weekend_study && (
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">
            Max. Wochenende: {Math.round(draft.weekend_max_minutes / 60)}h {draft.weekend_max_minutes % 60}min
          </label>
          <input type="range" min={30} max={480} step={30} value={draft.weekend_max_minutes}
            onChange={(e) => update("weekend_max_minutes", Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
        </div>
      )}

      <Toggle label="Feste Zeiten bevorzugen" description="Lernblöcke möglichst zur gleichen Zeit planen"
        checked={draft.prefer_consistent_times} onChange={(v) => update("prefer_consistent_times", v)} />
    </div>
  );

  const renderEnergyTab = () => (
    <div className="space-y-5">
      <p className="text-sm text-surface-500">
        Wie ist dein Energielevel zu verschiedenen Tageszeiten? Semetra plant anspruchsvolle Module in deine Hochphasen.
      </p>
      <EnergyBar label="Morgens (6–12 Uhr)" value={draft.energy_morning} onChange={(v) => update("energy_morning", v)} />
      <EnergyBar label="Nachmittags (12–18 Uhr)" value={draft.energy_afternoon} onChange={(v) => update("energy_afternoon", v)} />
      <EnergyBar label="Abends (18–24 Uhr)" value={draft.energy_evening} onChange={(v) => update("energy_evening", v)} />
    </div>
  );

  const renderAutomationTab = () => (
    <div className="space-y-4">
      <Toggle label="Auto-Plan" description="Automatisch Lernblöcke vorschlagen"
        checked={draft.auto_plan_enabled} onChange={(v) => update("auto_plan_enabled", v)} />
      <Toggle label="Verpasste Blöcke nachplanen" description="Verpasste Lerneinheiten automatisch verschieben"
        checked={draft.auto_reschedule_missed} onChange={(v) => update("auto_reschedule_missed", v)} />
      <Toggle label="Stundenplan-Sync" description="Stundenplan-Änderungen automatisch übernehmen"
        checked={draft.auto_sync_stundenplan} onChange={(v) => update("auto_sync_stundenplan", v)} />
      <Toggle label="Lücken füllen" description="Freie Zeitslots automatisch mit Lernblöcken füllen"
        checked={draft.auto_fill_gaps} onChange={(v) => update("auto_fill_gaps", v)} />

      <hr className="border-surface-100" />

      <h4 className="text-sm font-semibold text-surface-700">Prüfungsvorbereitung</h4>
      <div>
        <label className="block text-sm text-surface-700 mb-1">
          Start: {draft.exam_prep_start_days_before} Tage vorher
        </label>
        <input type="range" min={3} max={30} value={draft.exam_prep_start_days_before}
          onChange={(e) => update("exam_prep_start_days_before", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm text-surface-700 mb-1">
          Min. Vorbereitung: {draft.exam_prep_min_hours}h
        </label>
        <input type="range" min={2} max={40} value={draft.exam_prep_min_hours}
          onChange={(e) => update("exam_prep_min_hours", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm text-surface-700 mb-1">
          Max. pro Tag: {draft.exam_prep_daily_max_minutes} min
        </label>
        <input type="range" min={30} max={300} step={15} value={draft.exam_prep_daily_max_minutes}
          onChange={(e) => update("exam_prep_daily_max_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
    </div>
  );

  const renderPomodoroTab = () => (
    <div className="space-y-5">
      <p className="text-sm text-surface-500">
        Konfiguriere deinen Pomodoro-Timer. Diese Einstellungen werden auch im Timer übernommen.
      </p>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Fokuszeit: {draft.pomodoro_focus_minutes} min
        </label>
        <input type="range" min={15} max={60} step={5} value={draft.pomodoro_focus_minutes}
          onChange={(e) => update("pomodoro_focus_minutes", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Kurze Pause: {draft.pomodoro_short_break} min
        </label>
        <input type="range" min={2} max={15} value={draft.pomodoro_short_break}
          onChange={(e) => update("pomodoro_short_break", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Lange Pause: {draft.pomodoro_long_break} min
        </label>
        <input type="range" min={10} max={30} step={5} value={draft.pomodoro_long_break}
          onChange={(e) => update("pomodoro_long_break", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Sessions bis lange Pause: {draft.pomodoro_sessions_before_long}
        </label>
        <input type="range" min={2} max={8} value={draft.pomodoro_sessions_before_long}
          onChange={(e) => update("pomodoro_sessions_before_long", Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Zeitplan-Einstellungen" size="lg">
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-surface-50 rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-[rgb(var(--card-bg))] text-brand-600 shadow-sm"
                  : "text-surface-500 hover:text-surface-700"
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {tab === "time" && renderTimeTab()}
        {tab === "energy" && renderEnergyTab()}
        {tab === "automation" && renderAutomationTab()}
        {tab === "pomodoro" && renderPomodoroTab()}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-danger-50 border border-danger-100 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-surface-100">
        <Button variant="ghost" size="sm" onClick={resetToDefaults}>
          <RotateCcw size={14} />
          Zurücksetzen
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Speichern
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
