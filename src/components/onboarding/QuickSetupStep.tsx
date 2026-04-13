"use client";

/**
 * Quick Setup Step — Schritt 6 des Onboardings
 *
 * Hier kann der Nutzer direkt Module anlegen und seine erste Lernsession planen.
 * Das ist das "Aha-Moment" — statt auf einem leeren Dashboard zu landen.
 */

import { useState, useCallback, useEffect } from "react";
import { clsx } from "clsx";
import {
  BookOpen,
  Plus,
  X,
  Trash2,
  GraduationCap,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickModule {
  id: string;
  name: string;
  code: string;
  ects: number;
  color: string;
}

interface QuickSetupStepProps {
  modulesThisSemester: number;
  semesterNumber: number;
}

// ── Colors for modules ──────────────────────────────────────────────────────

const MODULE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#2563eb", "#7c3aed",
];

// ── Predefined module templates per study program ───────────────────────────

const PROGRAM_TEMPLATES: Record<string, Array<{ name: string; code: string; ects: number }>> = {
  informatik: [
    { name: "Programmieren 1", code: "PRG1", ects: 6 },
    { name: "Mathematik 1", code: "MAT1", ects: 6 },
    { name: "Algorithmen & Datenstrukturen", code: "ADS", ects: 6 },
    { name: "Betriebssysteme", code: "BS", ects: 3 },
    { name: "Webentwicklung", code: "WEB", ects: 6 },
    { name: "Datenbanken", code: "DB", ects: 6 },
  ],
  bwl: [
    { name: "Betriebswirtschaftslehre 1", code: "BWL1", ects: 6 },
    { name: "Rechnungswesen", code: "RW", ects: 6 },
    { name: "Volkswirtschaftslehre", code: "VWL", ects: 6 },
    { name: "Marketing Grundlagen", code: "MKT", ects: 3 },
    { name: "Wirtschaftsrecht", code: "WR", ects: 6 },
    { name: "Statistik", code: "STAT", ects: 6 },
  ],
  wirtschaftsinformatik: [
    { name: "Programmieren 1", code: "PRG1", ects: 6 },
    { name: "BWL Grundlagen", code: "BWL", ects: 6 },
    { name: "Datenbanken", code: "DB", ects: 6 },
    { name: "IT-Management", code: "ITM", ects: 3 },
    { name: "Wirtschaftsmathematik", code: "WMA", ects: 6 },
    { name: "Software Engineering", code: "SE", ects: 6 },
  ],
  maschinenbau: [
    { name: "Physik 1", code: "PHY1", ects: 6 },
    { name: "Mathematik 1", code: "MAT1", ects: 6 },
    { name: "Technische Mechanik", code: "TM", ects: 6 },
    { name: "Werkstoffkunde", code: "WK", ects: 3 },
    { name: "CAD", code: "CAD", ects: 6 },
    { name: "Thermodynamik", code: "TD", ects: 6 },
  ],
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function QuickSetupStep({
  modulesThisSemester,
  semesterNumber,
}: QuickSetupStepProps) {
  const [modules, setModules] = useState<QuickModule[]>([]);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newEcts, setNewEcts] = useState(6);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

  const supabase = createClient();

  // ── Add module ──
  const addModule = useCallback(() => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const color = MODULE_COLORS[modules.length % MODULE_COLORS.length];
    setModules((prev) => [
      ...prev,
      { id, name: newName.trim(), code: newCode.trim(), ects: newEcts, color },
    ]);
    setNewName("");
    setNewCode("");
    setNewEcts(6);
  }, [newName, newCode, newEcts, modules.length]);

  // ── Remove module ──
  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Apply template ──
  const applyTemplate = (key: string) => {
    const template = PROGRAM_TEMPLATES[key];
    if (!template) return;
    const newModules = template.slice(0, modulesThisSemester).map((t, i) => ({
      id: crypto.randomUUID(),
      name: t.name,
      code: t.code,
      ects: t.ects,
      color: MODULE_COLORS[i % MODULE_COLORS.length],
    }));
    setModules(newModules);
    setShowTemplates(false);
  };

  // ── Save to Supabase ──
  const saveModules = useCallback(async () => {
    if (modules.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      const rows = modules.map((m) => ({
        user_id: user.id,
        name: m.name,
        code: m.code || null,
        ects: m.ects,
        color: m.color,
        semester: semesterNumber,
        status: "active",
      }));

      const { error: insertErr } = await supabase.from("modules").insert(rows);
      if (insertErr) throw insertErr;

      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [modules, supabase, semesterNumber]);

  // Auto-save when user has modules
  useEffect(() => {
    if (saved || modules.length === 0) return;
    // Don't auto-save, let user decide
  }, [modules, saved]);

  const totalEcts = modules.reduce((s, m) => s + m.ects, 0);

  return (
    <div className="space-y-6">
      {/* Template suggestions */}
      {showTemplates && modules.length === 0 && (
        <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-brand-500" />
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">
              Schnellstart mit Vorlage
            </p>
          </div>
          <p className="text-xs text-brand-600 dark:text-brand-400/70 mb-3">
            Wähle deinen Studiengang und wir füllen die Module für dich aus:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PROGRAM_TEMPLATES).map((key) => (
              <button
                key={key}
                onClick={() => applyTemplate(key)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-surface-100 border border-brand-200 dark:border-brand-500/20 text-xs font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors capitalize"
              >
                {key.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTemplates(false)}
            className="mt-2 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            Lieber manuell eingeben →
          </button>
        </div>
      )}

      {/* Module list */}
      {modules.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-surface-700">
              Deine Module ({modules.length})
            </p>
            <p className="text-xs text-surface-400">{totalEcts} ECTS</p>
          </div>
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--card-bg))] border border-surface-200"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: mod.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">
                  {mod.name}
                </p>
                <p className="text-xs text-surface-400">
                  {mod.code ? `${mod.code} · ` : ""}
                  {mod.ects} ECTS
                </p>
              </div>
              <button
                onClick={() => removeModule(mod.id)}
                className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add module form */}
      {!saved && (
        <div className="p-4 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 space-y-3">
          <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
            <Plus size={14} /> Modul hinzufügen
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Modulname *"
              className="col-span-1 sm:col-span-2 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              onKeyDown={(e) => e.key === "Enter" && addModule()}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Kürzel"
                className="flex-1 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <input
                type="number"
                value={newEcts}
                onChange={(e) => setNewEcts(Number(e.target.value))}
                placeholder="ECTS"
                min={1}
                max={30}
                className="w-20 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <button
            onClick={addModule}
            disabled={!newName.trim()}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-surface-300 text-sm font-medium text-surface-500 hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-40"
          >
            + Hinzufügen
          </button>
        </div>
      )}

      {/* Save confirmation */}
      {modules.length > 0 && !saved && (
        <button
          onClick={saveModules}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="animate-spin">⏳</span> Wird gespeichert…
            </>
          ) : (
            <>
              <GraduationCap size={16} /> {modules.length} Module speichern
            </>
          )}
        </button>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
            <Check size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              {modules.length} Module gespeichert!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400/70">
              Du kannst sie jederzeit auf der Module-Seite bearbeiten.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Skip hint */}
      {modules.length === 0 && !showTemplates && (
        <p className="text-xs text-surface-400 text-center">
          Du kannst diesen Schritt überspringen und Module später hinzufügen.
        </p>
      )}
    </div>
  );
}
