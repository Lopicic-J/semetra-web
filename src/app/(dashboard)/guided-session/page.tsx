"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useModules } from "@/lib/hooks/useModules";
import {
  Brain, BookOpen, Target, MessageCircle, PenLine, Coffee,
  Play, Pause, SkipForward, CheckCircle2, Clock, AlertTriangle,
  GraduationCap, ArrowRight, Search,
} from "lucide-react";
import Link from "next/link";

interface Phase {
  name: string;
  type: "review" | "learn" | "practice" | "test" | "reflect" | "break";
  duration_min: number;
  description: string;
  icon: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  total_minutes: number;
  phases: Phase[];
  is_default: boolean;
}

type SessionPhase = "setup" | "active" | "reflection" | "done";

const PHASE_ICONS: Record<string, typeof Brain> = {
  Brain, BookOpen, Target, MessageCircle, PenLine, Coffee, AlertTriangle, GraduationCap, Search,
};

export default function GuidedSessionPage() {
  const { modules } = useModules();
  const searchParams = useSearchParams();
  const paramModule = searchParams.get("module");

  // Setup state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recommended, setRecommended] = useState<Template | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedModule, setSelectedModule] = useState(paramModule ?? "");
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [loading, setLoading] = useState(true);

  // Active session state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseSeconds, setPhaseSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // Reflection state
  const [learned, setLearned] = useState("");
  const [difficult, setDifficult] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [understanding, setUnderstanding] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [energy, setEnergy] = useState(3);

  const activeModules = modules.filter(m => m.status === "active" || m.status === "planned");
  const moduleName = modules.find(m => m.id === selectedModule)?.name;
  const moduleColor = modules.find(m => m.id === selectedModule)?.color;

  // Load templates (with fallback if table doesn't exist yet)
  useEffect(() => {
    fetch("/api/guided-session?recommended=true")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.all && data.all.length > 0) {
          setTemplates(data.all);
          setRecommended(data.recommended ?? null);
          setSelectedTemplate(data.recommended ?? data.all[0] ?? null);
        } else {
          // Fallback: hardcoded default template if DB table missing
          const fallback: Template = {
            id: "default",
            name: "Ausgewogen (45 Min)",
            description: "Balance aus Wiederholung, neuem Stoff, Übung und Reflexion",
            total_minutes: 45,
            phases: [
              { name: "Aufwärmen", type: "review", duration_min: 5, description: "Flashcards wiederholen", icon: "Brain" },
              { name: "Neuer Stoff", type: "learn", duration_min: 15, description: "Neue Inhalte durcharbeiten", icon: "BookOpen" },
              { name: "Üben", type: "practice", duration_min: 15, description: "Übungsaufgaben lösen", icon: "Target" },
              { name: "Selbsttest", type: "test", duration_min: 5, description: "Gelernte in eigenen Worten erklären", icon: "MessageCircle" },
              { name: "Reflexion", type: "reflect", duration_min: 5, description: "Was habe ich gelernt?", icon: "PenLine" },
            ],
            is_default: true,
          };
          setTemplates([fallback]);
          setSelectedTemplate(fallback);
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  // Timer logic
  useEffect(() => {
    if (phase !== "active" || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setPhaseSeconds(prev => prev + 1);
      setTotalElapsed(prev => prev + 1);
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, isPaused]);

  const currentPhase = selectedTemplate?.phases[currentPhaseIndex];
  const phaseTarget = (currentPhase?.duration_min ?? 0) * 60;
  const phaseProgress = phaseTarget > 0 ? Math.min(1, phaseSeconds / phaseTarget) : 0;
  const phaseTimeLeft = Math.max(0, phaseTarget - phaseSeconds);

  const startSession = () => {
    if (!selectedTemplate || !selectedModule) return;
    sessionStartRef.current = new Date();
    setCurrentPhaseIndex(0);
    setPhaseSeconds(0);
    setTotalElapsed(0);
    setIsPaused(false);
    setPhase("active");
  };

  const nextPhase = () => {
    if (!selectedTemplate) return;
    if (currentPhaseIndex < selectedTemplate.phases.length - 1) {
      setCurrentPhaseIndex(prev => prev + 1);
      setPhaseSeconds(0);
    } else {
      // All phases done → go to reflection
      setPhase("reflection");
    }
  };

  const submitReflection = async () => {
    await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId: selectedModule || null,
        learned: learned || null,
        difficult: difficult || null,
        nextSteps: nextSteps || null,
        understandingRating: understanding,
        confidenceRating: confidence,
        energyAfter: energy,
        sessionDurationSeconds: totalElapsed,
        sessionType: "guided",
      }),
    });

    // Also trigger DNA micro-update
    await fetch("/api/learning-dna", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        focusRating: understanding,
        energyLevel: energy,
        durationMinutes: Math.round(totalElapsed / 60),
        alignment: "within_plan",
      }),
    });

    setPhase("done");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── SETUP ──
  if (phase === "setup") {
    if (loading) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain size={28} className="text-brand-500" />
          </div>
          <p className="text-surface-500">Templates werden geladen...</p>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Brain size={28} className="text-brand-500" />
            Geführte Lernsession
          </h1>
          <p className="text-surface-500 mt-1">Strukturiert lernen in Phasen — Review, Stoff, Übung, Test, Reflexion</p>
        </div>

        {/* Module Selection */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-5">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Modul wählen</label>
          <select
            value={selectedModule}
            onChange={e => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
          >
            <option value="">Modul auswählen...</option>
            {activeModules.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Template Selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Session-Vorlage wählen</p>
          {templates.map(tmpl => {
            const isRec = recommended?.id === tmpl.id;
            const isSelected = selectedTemplate?.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 shadow-sm"
                    : "border-surface-200 dark:border-surface-700 hover:border-surface-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-surface-900 dark:text-surface-50 text-sm">{tmpl.name}</p>
                      {isRec && <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-medium">Empfohlen</span>}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">{tmpl.description}</p>
                  </div>
                  <span className="text-sm font-medium text-surface-400 shrink-0">{tmpl.total_minutes} Min</span>
                </div>
                {isSelected && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-100 dark:border-surface-800">
                    {tmpl.phases.map((p, i) => {
                      const Icon = PHASE_ICONS[p.icon] ?? Brain;
                      return (
                        <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                          <Icon size={10} /> {p.name} ({p.duration_min}m)
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Start Button */}
        <button
          onClick={startSession}
          disabled={!selectedModule || !selectedTemplate}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-600 text-white font-semibold text-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play size={20} fill="white" /> Session starten
        </button>
      </div>
    );
  }

  // ── ACTIVE SESSION ──
  if (phase === "active" && currentPhase) {
    const PhaseIcon = PHASE_ICONS[currentPhase.icon] ?? Brain;
    const phaseColors: Record<string, string> = {
      review: "text-violet-600 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40",
      learn: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40",
      practice: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40",
      test: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40",
      reflect: "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40",
      break: "text-surface-600 bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700",
    };
    const colorClass = phaseColors[currentPhase.type] ?? phaseColors.learn;

    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Phase Progress Dots */}
        <div className="flex items-center justify-center gap-2">
          {selectedTemplate!.phases.map((p, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
              i < currentPhaseIndex ? "bg-emerald-500" :
              i === currentPhaseIndex ? "bg-brand-500 scale-125" :
              "bg-surface-300 dark:bg-surface-600"
            }`} />
          ))}
        </div>

        {/* Module Context */}
        <div className="flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: moduleColor ?? "#6d28d9" }} />
          <span className="text-sm text-surface-500">{moduleName}</span>
          <span className="text-xs text-surface-400">· Phase {currentPhaseIndex + 1}/{selectedTemplate!.phases.length}</span>
        </div>

        {/* Phase Card */}
        <div className={`rounded-2xl border p-8 text-center ${colorClass}`}>
          <PhaseIcon size={40} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-1">{currentPhase.name}</h2>
          <p className="text-sm opacity-80 mb-6">{currentPhase.description}</p>

          {/* Timer */}
          <div className="text-4xl font-mono font-bold mb-2">
            {formatTime(phaseTimeLeft)}
          </div>
          <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-current rounded-full transition-all duration-1000" style={{ width: `${phaseProgress * 100}%` }} />
          </div>

          {/* Phase-specific suggestions */}
          {currentPhase.type === "review" && (
            <Link href={`/flashcards?module=${selectedModule}`} className="inline-flex items-center gap-2 text-sm underline opacity-70 hover:opacity-100 no-underline">
              <Brain size={14} /> Flashcards öffnen
            </Link>
          )}
          {currentPhase.type === "practice" && (
            <Link href={`/exam-simulator?module=${selectedModule}`} className="inline-flex items-center gap-2 text-sm underline opacity-70 hover:opacity-100 no-underline">
              <Target size={14} /> Prüfungssimulator öffnen
            </Link>
          )}
          {currentPhase.type === "test" && (
            <p className="text-xs opacity-60">Erkläre das Gelernte laut oder schriftlich — ohne Hilfsmittel</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsPaused(prev => !prev)}
            className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            {isPaused ? <Play size={20} className="text-surface-600" /> : <Pause size={20} className="text-surface-600" />}
          </button>
          <button
            onClick={nextPhase}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 font-semibold hover:opacity-90 transition-opacity"
          >
            {currentPhaseIndex < selectedTemplate!.phases.length - 1
              ? <><SkipForward size={16} /> Nächste Phase</>
              : <><CheckCircle2 size={16} /> Abschliessen</>
            }
          </button>
        </div>

        {/* Total Elapsed */}
        <p className="text-center text-xs text-surface-400 flex items-center justify-center gap-1">
          <Clock size={10} /> Gesamt: {formatTime(totalElapsed)}
        </p>
      </div>
    );
  }

  // ── REFLECTION ──
  if (phase === "reflection") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mx-auto mb-3">
            <PenLine size={28} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">Reflexion</h2>
          <p className="text-sm text-surface-500 mt-1">{Math.round(totalElapsed / 60)} Minuten gelernt · {moduleName}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-1.5">Was habe ich gelernt?</label>
            <textarea value={learned} onChange={e => setLearned(e.target.value)} placeholder="Die wichtigsten Erkenntnisse..."
              className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-1.5">Was war schwierig?</label>
            <textarea value={difficult} onChange={e => setDifficult(e.target.value)} placeholder="Stellen wo ich unsicher bin..."
              className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-1.5">Was muss ich nochmal machen?</label>
            <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} placeholder="Nächste Schritte..."
              className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm min-h-[60px] resize-none" />
          </div>

          {/* Ratings */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ["Verständnis", understanding, setUnderstanding, "Wie gut habe ich verstanden?"],
              ["Sicherheit", confidence, setConfidence, "Wie prüfungssicher fühle ich mich?"],
              ["Energie", energy, setEnergy, "Wie fühle ich mich?"],
            ] as const).map(([label, value, setter, tooltip]) => (
              <div key={label} className="text-center">
                <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">{label}</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => (setter as (v: number) => void)(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                        n <= value
                          ? "bg-brand-500 text-white"
                          : "bg-surface-100 dark:bg-surface-800 text-surface-400 hover:bg-surface-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={submitReflection}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
        >
          <CheckCircle2 size={18} /> Reflexion speichern
        </button>
      </div>
    );
  }

  // ── DONE ──
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
        <CheckCircle2 size={36} className="text-emerald-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">Session abgeschlossen!</h2>
        <p className="text-surface-500 mt-1">
          {Math.round(totalElapsed / 60)} Min · {selectedTemplate?.phases.length} Phasen · {moduleName}
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { setPhase("setup"); setCurrentPhaseIndex(0); setTotalElapsed(0); setLearned(""); setDifficult(""); setNextSteps(""); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800">
          Neue Session
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 no-underline">
          <ArrowRight size={14} /> Dashboard
        </Link>
      </div>
    </div>
  );
}
