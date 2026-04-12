"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen, Timer, Calendar, Brain, Users, BarChart3,
  GraduationCap, ArrowRight, X, Sparkles, Rocket,
} from "lucide-react";

interface TourStep {
  icon: typeof BookOpen;
  color: string;
  title: string;
  description: string;
  tip: string;
  path: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: BookOpen,
    color: "text-brand-500 bg-brand-50 dark:bg-brand-950/30",
    title: "Module & Aufgaben",
    description: "Verwalte deine Studienmodule, Aufgaben und Prüfungstermine an einem Ort.",
    tip: "Tipp: Starte mit dem Anlegen deiner aktuellen Module",
    path: "/modules",
  },
  {
    icon: Timer,
    color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
    title: "Lernzeit tracken",
    description: "Starte den Timer wenn du lernst — Semetra trackt deine Fortschritte und baut Streaks auf.",
    tip: "Tipp: Wähle ein Modul bevor du startest, für bessere Statistiken",
    path: "/timer",
  },
  {
    icon: Calendar,
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    title: "Stundenplan",
    description: "Trage deinen Stundenplan ein — Semetra plant Lernblöcke intelligent um deine Vorlesungen.",
    tip: "Tipp: Auf Mobile kannst du durch die Tage wischen",
    path: "/stundenplan",
  },
  {
    icon: Brain,
    color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30",
    title: "KI-Assistent",
    description: "Frag den KI-Assistenten was du nicht verstehst — er kennt deine Module und passt sich an.",
    tip: "Tipp: Je spezifischer die Frage, desto besser die Antwort",
    path: "/ai-assistant",
  },
  {
    icon: Users,
    color: "text-green-500 bg-green-50 dark:bg-green-950/30",
    title: "Lerngruppen",
    description: "Erstelle Gruppen mit Kommilitonen, chattet und teilt Module, Notizen und Dokumente.",
    tip: "Tipp: Teile den Einladungscode mit deiner WhatsApp-Gruppe",
    path: "/groups",
  },
  {
    icon: BarChart3,
    color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
    title: "Fortschritt & Analytics",
    description: "Sieh wie viel du gelernt hast, erkenne Muster und optimiere dein Studium.",
    tip: "Tipp: Schau wöchentlich rein für dein Weekly Review",
    path: "/progress",
  },
];

export default function WelcomeTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    // Check if user has seen the tour
    const seen = localStorage.getItem("semetra_tour_seen");
    if (seen) return;

    // Small delay so dashboard loads first
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("semetra_tour_seen", "1");
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-brand-600 to-violet-600 p-5 text-white">
          <button onClick={dismiss} className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 dark:bg-surface-800 transition-colors">
            <X size={18} />
          </button>

          {step === 0 ? (
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 dark:bg-surface-800 rounded-xl">
                <Rocket size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Willkommen bei Semetra!</h2>
                <p className="text-sm text-white/80">Dein persönlicher Studienbegleiter — lass uns kurz durchgehen was du alles machen kannst.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-white/60" />
              <p className="text-sm font-medium text-white/80">Schnelltour · {step + 1} von {TOUR_STEPS.length}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl shrink-0 ${current.color}`}>
              <Icon size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white mb-1">{current.title}</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-3.5 py-2.5 mb-5">
            <p className="text-xs text-amber-700 dark:text-amber-400">{current.tip}</p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-brand-600 dark:bg-brand-500"
                    : i < step
                    ? "bg-brand-300 dark:bg-brand-700"
                    : "bg-surface-200 dark:bg-surface-700"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                Zurück
              </button>
            )}
            <button onClick={dismiss} className="px-4 py-2 rounded-xl text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors ml-auto">
              Überspringen
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all active:scale-[0.98]"
            >
              {isLast ? (
                <>Los geht's <Rocket size={14} /></>
              ) : (
                <>Weiter <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
