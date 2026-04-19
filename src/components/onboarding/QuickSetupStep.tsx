"use client";

/**
 * Quick Setup Step — Schritt 6 des Onboardings
 *
 * Intelligenter Setup mit 3 Pfaden:
 * A) Institution erkannt → Auto-Import der Studiengang-Module
 * B) Keine Institution → Generische Templates oder manuell
 * C) Höheres Semester → Bisherige Module als abgeschlossen + Noten
 *
 * Das ist das "Aha-Moment" — statt auf einem leeren Dashboard zu landen.
 */

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getGradingSystem, type CountryCode } from "@/lib/grading-systems";
import {
  BookOpen, Plus, X, Trash2, GraduationCap, Sparkles,
  Check, AlertCircle, Building2, ArrowRight, Clock,
  CheckCircle2, Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickModule {
  id: string;
  name: string;
  code: string;
  ects: number;
  color: string;
  fromInstitution?: boolean;
  pastSemester?: boolean;     // Module from a previous semester
  grade?: number | null;      // Grade for past modules
}

interface QuickSetupStepProps {
  modulesThisSemester: number;
  semesterNumber: number;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const MODULE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#2563eb", "#7c3aed",
];

// ── Templates (Fallback wenn keine Institution) ──────────────────────────────

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
  const supabase = createClient();

  // State
  const [modules, setModules] = useState<QuickModule[]>([]);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newEcts, setNewEcts] = useState(6);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

  // Institution detection
  const [hasInstitution, setHasInstitution] = useState<boolean | null>(null); // null = loading
  const [institutionName, setInstitutionName] = useState("");
  const [programName, setProgramName] = useState("");
  const [institutionModules, setInstitutionModules] = useState<any[]>([]);
  const [importingInstitution, setImportingInstitution] = useState(false);
  const [institutionImported, setInstitutionImported] = useState(false);

  // Grading system (based on student's country)
  const [gradingCountry, setGradingCountry] = useState<CountryCode>("CH");
  const gradingSystem = getGradingSystem(gradingCountry);

  // Higher semester
  const isHigherSemester = semesterNumber > 1;

  // ── Check if student has institution/program from registration ──
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasInstitution(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("institution_id, active_program_id, university, study_program, current_semester, country")
        .eq("id", user.id)
        .single();

      // Set country for grading system
      if (profile?.country) {
        setGradingCountry(profile.country as CountryCode);
      }

      // Institution auto-import gated behind feature flag (consumer-mode default)
      const { ONBOARDING_INSTITUTION_AUTO_IMPORT } = await import("@/lib/feature-flags");

      if (ONBOARDING_INSTITUTION_AUTO_IMPORT && profile?.active_program_id) {
        setHasInstitution(true);
        setInstitutionName(profile.university ?? "");
        setProgramName(profile.study_program ?? "");

        // Fetch institution program modules (templates)
        const { data: progModules } = await supabase
          .from("modules")
          .select("id, name, code, ects, semester, color")
          .eq("program_id", profile.active_program_id)
          .is("user_id", null) // Template modules only
          .order("semester")
          .order("name");

        if (progModules && progModules.length > 0) {
          setInstitutionModules(progModules);
          // Auto-populate module list with institution modules
          const mapped: QuickModule[] = progModules.map((m, i) => {
            const semNum = m.semester ? parseInt(m.semester, 10) : 99;
            const isPast = semNum < semesterNumber;
            return {
              id: m.id,
              name: m.name,
              code: m.code ?? "",
              ects: m.ects ?? 0,
              color: m.color ?? MODULE_COLORS[i % MODULE_COLORS.length],
              fromInstitution: true,
              pastSemester: isPast,
              grade: null,
            };
          });
          setModules(mapped);
          setShowTemplates(false);
        } else {
          setHasInstitution(false);
        }
      } else {
        setHasInstitution(false);
      }
    }
    check();
  }, [supabase, semesterNumber]);

  // ── Add manual module ──
  const addModule = useCallback(() => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const color = MODULE_COLORS[modules.length % MODULE_COLORS.length];
    setModules(prev => [
      ...prev,
      { id, name: newName.trim(), code: newCode.trim(), ects: newEcts, color },
    ]);
    setNewName("");
    setNewCode("");
    setNewEcts(6);
  }, [newName, newCode, newEcts, modules.length]);

  const removeModule = (id: string) => setModules(prev => prev.filter(m => m.id !== id));

  // ── Apply template (no-institution fallback) ──
  const applyTemplate = (key: string) => {
    const template = PROGRAM_TEMPLATES[key];
    if (!template) return;
    setModules(template.slice(0, modulesThisSemester).map((t, i) => ({
      id: crypto.randomUUID(),
      name: t.name,
      code: t.code,
      ects: t.ects,
      color: MODULE_COLORS[i % MODULE_COLORS.length],
    })));
    setShowTemplates(false);
  };

  // ── Set grade for past module ──
  const setModuleGrade = (id: string, grade: number | null) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, grade } : m));
  };

  // ── Save all modules ──
  const saveModules = useCallback(async () => {
    if (modules.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      // Split into current + past modules
      const currentModules = modules.filter(m => !m.pastSemester);
      const pastModules = modules.filter(m => m.pastSemester);

      // Save current semester modules as "active"
      if (currentModules.length > 0) {
        const rows = currentModules.map(m => ({
          user_id: user.id,
          name: m.name,
          code: m.code || null,
          ects: m.ects,
          color: m.color,
          semester: String(semesterNumber),
          status: "active",
        }));
        const { error: insertErr } = await supabase.from("modules").insert(rows);
        if (insertErr) throw insertErr;
      }

      // Save past semester modules as "completed" with grades
      if (pastModules.length > 0) {
        const rows = pastModules.map(m => {
          const semNum = institutionModules.find(im => im.id === m.id)?.semester;
          return {
            user_id: user.id,
            name: m.name,
            code: m.code || null,
            ects: m.ects,
            color: m.color,
            semester: semNum ? String(parseInt(semNum, 10)) : String(Math.max(1, semesterNumber - 1)),
            status: "completed",
          };
        });
        const { error: insertErr } = await supabase.from("modules").insert(rows).select();
        if (insertErr) throw insertErr;

        // Save grades for past modules that have them
        const modulesWithGrades = pastModules.filter(m => m.grade && m.grade > 0);
        if (modulesWithGrades.length > 0) {
          // Need the IDs of just-created modules
          const { data: createdModules } = await supabase
            .from("modules")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("status", "completed");

          if (createdModules) {
            const gradeRows = modulesWithGrades
              .map(m => {
                const created = createdModules.find(cm => cm.name === m.name);
                if (!created || !m.grade) return null;
                return {
                  user_id: user.id,
                  module_id: created.id,
                  title: "Modulnote",
                  grade: m.grade,
                  weight: 1,
                  date: new Date().toISOString().split("T")[0],
                };
              })
              .filter(Boolean);

            if (gradeRows.length > 0) {
              await supabase.from("grades").insert(gradeRows);
            }
          }
        }
      }

      // Mark institution modules as loaded to prevent duplicate auto-import
      if (hasInstitution) {
        await supabase.from("profiles").update({
          institution_modules_loaded: true,
        }).eq("id", user.id);
      }

      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [modules, supabase, semesterNumber, hasInstitution, institutionModules]);

  const totalEcts = modules.reduce((s, m) => s + m.ects, 0);
  const currentModules = modules.filter(m => !m.pastSemester);
  const pastModules = modules.filter(m => m.pastSemester);

  // Still loading institution check
  if (hasInstitution === null) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center text-surface-500">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Studiengang wird geprüft...</span>
      </div>
    );
  }

  // ── SAVED STATE ──
  if (saved) {
    return (
      <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {modules.length} Module gespeichert!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400/70">
              {currentModules.length > 0 && `${currentModules.length} aktiv`}
              {pastModules.length > 0 && ` · ${pastModules.length} abgeschlossen`}
              {pastModules.filter(m => m.grade).length > 0 && ` · ${pastModules.filter(m => m.grade).length} mit Note`}
            </p>
          </div>
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400/70">
          Tipp: Nach dem Onboarding kannst du auf der Module-Seite KI-gestützt Topics und Flashcards für jedes Modul generieren lassen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── INSTITUTION DETECTED ── */}
      {hasInstitution && !institutionImported && (
        <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Building2 size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {institutionName}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400/70">
                {programName} · Semester {semesterNumber}
              </p>
            </div>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300/80 mb-3">
            {institutionModules.length > 0
              ? `${institutionModules.length} Module aus deinem Studiengang gefunden. Wir haben sie unten eingetragen — passe sie an deine Situation an.`
              : "Dein Studiengang ist erkannt, aber es sind noch keine Module hinterlegt."
            }
          </p>
          {institutionModules.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <Check size={12} /> Module automatisch importiert
            </div>
          )}
        </div>
      )}

      {/* ── HIGHER SEMESTER INFO ── */}
      {isHigherSemester && modules.length > 0 && pastModules.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-amber-600" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Semester {semesterNumber} — {pastModules.length} Module aus früheren Semestern
            </p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300/70">
            Die Module aus vergangenen Semestern werden als &ldquo;abgeschlossen&rdquo; gespeichert.
            Du kannst optional eine Note eintragen ({gradingSystem.scaleLabel}) — das verbessert deine Notenprognosen.
          </p>
        </div>
      )}

      {/* ── TEMPLATE SELECTION (no institution) ── */}
      {!hasInstitution && showTemplates && modules.length === 0 && (
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
            {Object.keys(PROGRAM_TEMPLATES).map(key => (
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
            className="mt-2 text-xs text-brand-500 hover:text-brand-700"
          >
            Lieber manuell eingeben →
          </button>
        </div>
      )}

      {/* ── CURRENT SEMESTER MODULES ── */}
      {currentModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
            <BookOpen size={14} className="text-brand-500" />
            Aktuelle Module — Semester {semesterNumber} ({currentModules.length})
          </p>
          {currentModules.map(mod => (
            <div key={mod.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--card-bg))] border border-surface-200">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: mod.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">{mod.name}</p>
                <p className="text-xs text-surface-400">{mod.code ? `${mod.code} · ` : ""}{mod.ects} ECTS</p>
              </div>
              {!mod.fromInstitution && (
                <button onClick={() => removeModule(mod.id)} className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PAST SEMESTER MODULES (Higher Semester) ── */}
      {pastModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            Abgeschlossene Module ({pastModules.length})
            <span className="text-[10px] text-surface-400 font-normal">— Note optional</span>
          </p>
          {pastModules.map(mod => {
            const semLabel = institutionModules.find(im => im.id === mod.id)?.semester;
            return (
              <div key={mod.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-800/30">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: mod.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{mod.name}</p>
                  <p className="text-xs text-surface-400">
                    {mod.code ? `${mod.code} · ` : ""}{mod.ects} ECTS
                    {semLabel && ` · Sem. ${parseInt(semLabel, 10)}`}
                  </p>
                </div>
                <input
                  type="number"
                  min={gradingSystem.min}
                  max={gradingSystem.max}
                  step={gradingSystem.step}
                  value={mod.grade ?? ""}
                  onChange={e => setModuleGrade(mod.id, e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder={gradingSystem.inputPlaceholder || `${gradingSystem.min}–${gradingSystem.max}`}
                  className="w-20 px-2 py-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-xs text-center"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD MODULE FORM ── */}
      {!saved && (
        <div className="p-4 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 space-y-3">
          <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
            <Plus size={14} /> Modul hinzufügen
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Modulname *"
              className="col-span-1 sm:col-span-2 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              onKeyDown={e => e.key === "Enter" && addModule()} />
            <div className="flex gap-2">
              <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)}
                placeholder="Kürzel" className="flex-1 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm placeholder:text-surface-400" />
              <input type="number" value={newEcts} onChange={e => setNewEcts(Number(e.target.value))}
                placeholder="ECTS" min={1} max={30}
                className="w-20 px-3 py-2.5 rounded-xl border border-surface-200 bg-transparent text-sm placeholder:text-surface-400" />
            </div>
          </div>
          <button onClick={addModule} disabled={!newName.trim()}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-surface-300 text-sm font-medium text-surface-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-40">
            + Hinzufügen
          </button>
        </div>
      )}

      {/* ── SAVE BUTTON ── */}
      {modules.length > 0 && !saved && (
        <button onClick={saveModules} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Wird gespeichert…</>
          ) : (
            <><GraduationCap size={16} /> {modules.length} Module speichern
              {pastModules.filter(m => m.grade).length > 0 && ` (${pastModules.filter(m => m.grade).length} mit Note)`}
            </>
          )}
        </button>
      )}

      {/* ── SUMMARY ── */}
      {modules.length > 0 && !saved && (
        <p className="text-xs text-center text-surface-400">
          {totalEcts} ECTS · {currentModules.length} aktiv · {pastModules.length} abgeschlossen
        </p>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── SKIP HINT ── */}
      {modules.length === 0 && !showTemplates && !hasInstitution && (
        <p className="text-xs text-surface-400 text-center">
          Du kannst diesen Schritt überspringen und Module später hinzufügen.
        </p>
      )}
    </div>
  );
}
