"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Target,
  Clock,
  Zap,
  Brain,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Gem,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface StepConfig {
  step: number;
  step_name: string;
  title: string;
  subtitle: string;
  icon: typeof Target;
  gradient: string;
}

const STEPS: StepConfig[] = [
  { step: 1, step_name: "goals", title: "Deine Lernziele", subtitle: "Was möchtest du mit Semetra erreichen?", icon: Target, gradient: "from-indigo-500 to-brand-600" },
  { step: 2, step_name: "schedule", title: "Dein Zeitplan", subtitle: "Wann hast du Zeit zum Lernen?", icon: Clock, gradient: "from-cyan-500 to-blue-600" },
  { step: 3, step_name: "energy", title: "Energie & Fokus", subtitle: "Wann bist du am produktivsten?", icon: Zap, gradient: "from-amber-500 to-orange-600" },
  { step: 4, step_name: "learning_style", title: "Dein Lernstil", subtitle: "Wie lernst du am liebsten?", icon: Brain, gradient: "from-violet-500 to-purple-600" },
  { step: 5, step_name: "situation", title: "Deine Situation", subtitle: "Wo stehst du gerade im Studium?", icon: BookOpen, gradient: "from-emerald-500 to-green-600" },
];

type GoalType = "pass_exams" | "improve_grades" | "time_management" | "reduce_stress" | "learn_efficiently";

interface GoalsData {
  primary_goal: GoalType;
  weekly_study_target_hours: number;
}

interface ScheduleData {
  wake_time: string;
  sleep_time: string;
  available_from: string;
  available_until: string;
  busy_days: string[];
  has_job: boolean;
  job_hours_per_week: number;
}

interface EnergyData {
  energy_morning: number;
  energy_afternoon: number;
  energy_evening: number;
  preferred_session_length: number;
  focus_challenge: "easily_distracted" | "moderate" | "very_focused";
}

type LearningStyleType = "visual" | "auditory" | "reading" | "kinesthetic" | "mixed";

interface LearningStyleData {
  learning_style: LearningStyleType;
  prefers_group_study: boolean;
  uses_flashcards: boolean;
  uses_pomodoro: boolean;
  takes_notes: boolean;
}

interface SituationData {
  semester_number: number;
  modules_this_semester: number;
  exam_anxiety_level: number;
}

// ── Default values ───────────────────────────────────────────────────────────

const defaultGoals: GoalsData = { primary_goal: "pass_exams", weekly_study_target_hours: 20 };
const defaultSchedule: ScheduleData = { wake_time: "07:00", sleep_time: "23:00", available_from: "08:00", available_until: "20:00", busy_days: [], has_job: false, job_hours_per_week: 0 };
const defaultEnergy: EnergyData = { energy_morning: 3, energy_afternoon: 3, energy_evening: 3, preferred_session_length: 45, focus_challenge: "moderate" };
const defaultLearningStyle: LearningStyleData = { learning_style: "mixed", prefers_group_study: false, uses_flashcards: false, uses_pomodoro: false, takes_notes: true };
const defaultSituation: SituationData = { semester_number: 1, modules_this_semester: 6, exam_anxiety_level: 3 };

// ── Helper components ────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  label,
  description,
  icon: Icon,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  icon?: typeof Target;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200",
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-md shadow-brand-500/10"
          : "border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] hover:border-surface-300 dark:hover:border-surface-600 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={clsx(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            selected ? "bg-brand-100 dark:bg-brand-500/20 text-brand-600" : "bg-surface-100 dark:bg-surface-800 text-surface-500"
          )}>
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <p className={clsx("font-semibold text-sm sm:text-base", selected ? "text-brand-700 dark:text-brand-400" : "text-surface-700 dark:text-surface-500")}>{label}</p>
          {description && <p className="text-xs sm:text-sm text-surface-500 mt-0.5">{description}</p>}
        </div>
        {selected && (
          <div className="ml-auto flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function EnergySlider({
  label,
  value,
  onChange,
  emoji,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  emoji: string;
}) {
  const labels = ["Sehr tief", "Tief", "Mittel", "Hoch", "Sehr hoch"];
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-400"];
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500">
          {emoji} {label}
        </span>
        <span className={clsx("text-xs font-semibold px-2.5 py-1 rounded-full", colors[value - 1], "text-white")}>{labels[value - 1]}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-surface-400 mt-1.5 px-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className={clsx(value === n && "text-brand-500 font-bold")}>{n}</span>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border-2",
        active
          ? "bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20"
          : "bg-[rgb(var(--card-bg))] text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300"
      )}
    >
      {active && <span className="mr-1">&#10003;</span>}
      {label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingQuestionnaire() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goals, setGoals] = useState<GoalsData>(defaultGoals);
  const [schedule, setSchedule] = useState<ScheduleData>(defaultSchedule);
  const [energy, setEnergy] = useState<EnergyData>(defaultEnergy);
  const [learningStyle, setLearningStyle] = useState<LearningStyleData>(defaultLearningStyle);
  const [situation, setSituation] = useState<SituationData>(defaultSituation);

  const stepConfig = STEPS[currentStep];

  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 0: return goals.primary_goal && goals.weekly_study_target_hours > 0;
      case 1: return schedule.wake_time && schedule.sleep_time;
      case 2: return energy.preferred_session_length > 0;
      case 3: return !!learningStyle.learning_style;
      case 4: return situation.semester_number > 0 && situation.modules_this_semester > 0;
      default: return false;
    }
  }, [currentStep, goals, schedule, energy, learningStyle, situation]);

  const buildFlatData = useCallback((): Record<string, unknown> => {
    const sessionLengthMap = (minutes: number): string => {
      if (minutes <= 30) return "short";
      if (minutes <= 60) return "medium";
      return "long";
    };

    return {
      primary_goal: goals.primary_goal,
      weekly_study_target_hours: goals.weekly_study_target_hours,
      typical_wake_time: schedule.wake_time,
      typical_sleep_time: schedule.sleep_time,
      available_from: schedule.available_from,
      available_until: schedule.available_until,
      busy_days: schedule.busy_days,
      has_job: schedule.has_job,
      job_hours_per_week: schedule.job_hours_per_week,
      energy_morning: energy.energy_morning,
      energy_afternoon: energy.energy_afternoon,
      energy_evening: energy.energy_evening,
      preferred_session_length: sessionLengthMap(energy.preferred_session_length),
      focus_challenge: energy.focus_challenge,
      learning_style: learningStyle.learning_style,
      prefers_group_study: learningStyle.prefers_group_study,
      uses_flashcards: learningStyle.uses_flashcards,
      uses_pomodoro: learningStyle.uses_pomodoro,
      uses_notes: learningStyle.takes_notes,
      semester_number: situation.semester_number,
      modules_this_semester: situation.modules_this_semester,
      exam_anxiety_level: situation.exam_anxiety_level,
    };
  }, [goals, schedule, energy, learningStyle, situation]);

  const saveAndAdvance = useCallback(async () => {
    if (!canGoNext()) return;
    setSaving(true);
    setError(null);

    const isLastStep = currentStep === STEPS.length - 1;

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: buildFlatData(),
          step: currentStep + 1,
          finalize: isLastStep,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Speichern fehlgeschlagen");
      }

      if (isLastStep) {
        router.push("/dashboard");
      } else {
        setCurrentStep((s) => s + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }, [canGoNext, currentStep, buildFlatData, router]);

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  // ── Step Renderers ───────────────────────────────────────────────────────

  const GOAL_OPTIONS: { value: GoalType; label: string; desc: string; icon: typeof Target }[] = [
    { value: "pass_exams", label: "Prüfungen bestehen", desc: "Alle Module sicher bestehen", icon: Check },
    { value: "improve_grades", label: "Noten verbessern", desc: "Bessere Noten in meinen Modulen", icon: Sparkles },
    { value: "time_management", label: "Zeitmanagement", desc: "Besser organisiert sein", icon: Clock },
    { value: "reduce_stress", label: "Weniger Stress", desc: "Prüfungsstress reduzieren", icon: Zap },
    { value: "learn_efficiently", label: "Effizienter lernen", desc: "Mehr in weniger Zeit lernen", icon: Brain },
  ];

  const DAYS = [
    { value: "Mo", label: "Mo" }, { value: "Di", label: "Di" }, { value: "Mi", label: "Mi" },
    { value: "Do", label: "Do" }, { value: "Fr", label: "Fr" }, { value: "Sa", label: "Sa" }, { value: "So", label: "So" },
  ];

  const renderGoalsStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Was ist dein Hauptziel?</label>
        <div className="space-y-2.5">
          {GOAL_OPTIONS.map((opt) => (
            <OptionCard key={opt.value} selected={goals.primary_goal === opt.value} onClick={() => setGoals((g) => ({ ...g, primary_goal: opt.value }))} label={opt.label} description={opt.desc} icon={opt.icon} />
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">
          Wie viele Stunden pro Woche möchtest du lernen?
        </label>
        <div className="flex items-center gap-4">
          <input type="range" min={5} max={60} step={5} value={goals.weekly_study_target_hours}
            onChange={(e) => setGoals((g) => ({ ...g, weekly_study_target_hours: Number(e.target.value) }))}
            className="flex-1 h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer" />
          <span className="text-2xl font-bold text-brand-600 min-w-[4rem] text-right">{goals.weekly_study_target_hours}h</span>
        </div>
        <div className="flex justify-between text-xs text-surface-400 mt-1"><span>5h</span><span>Wenig</span><span>Mittel</span><span>Viel</span><span>60h</span></div>
      </div>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-semibold text-surface-700 dark:text-surface-500 mb-1.5">Aufstehzeit</label>
          <input type="time" value={schedule.wake_time} onChange={(e) => setSchedule((s) => ({ ...s, wake_time: e.target.value }))}
            className="w-full px-3 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-surface-800 dark:text-surface-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm sm:text-base" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-surface-700 dark:text-surface-500 mb-1.5">Schlafenszeit</label>
          <input type="time" value={schedule.sleep_time} onChange={(e) => setSchedule((s) => ({ ...s, sleep_time: e.target.value }))}
            className="w-full px-3 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-surface-800 dark:text-surface-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm sm:text-base" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-semibold text-surface-700 dark:text-surface-500 mb-1.5">Lernzeit ab</label>
          <input type="time" value={schedule.available_from} onChange={(e) => setSchedule((s) => ({ ...s, available_from: e.target.value }))}
            className="w-full px-3 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-surface-800 dark:text-surface-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm sm:text-base" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-surface-700 dark:text-surface-500 mb-1.5">Lernzeit bis</label>
          <input type="time" value={schedule.available_until} onChange={(e) => setSchedule((s) => ({ ...s, available_until: e.target.value }))}
            className="w-full px-3 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-surface-800 dark:text-surface-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm sm:text-base" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-500 mb-3">Beschäftigte Tage</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <ToggleChip key={day.value} label={day.label} active={schedule.busy_days.includes(day.value)}
              onClick={() => setSchedule((s) => ({ ...s, busy_days: s.busy_days.includes(day.value) ? s.busy_days.filter((d) => d !== day.value) : [...s.busy_days, day.value] }))} />
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={schedule.has_job}
            onChange={(e) => setSchedule((s) => ({ ...s, has_job: e.target.checked, job_hours_per_week: e.target.checked ? s.job_hours_per_week : 0 }))}
            className="w-5 h-5 rounded border-surface-300 text-brand-500 focus:ring-brand-500" />
          <span className="text-sm sm:text-base text-surface-700 dark:text-surface-500 font-medium">Ich arbeite neben dem Studium</span>
        </label>
        {schedule.has_job && (
          <div className="mt-4 ml-8">
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1.5">Stunden pro Woche</label>
            <input type="number" min={1} max={40} value={schedule.job_hours_per_week}
              onChange={(e) => setSchedule((s) => ({ ...s, job_hours_per_week: Number(e.target.value) }))}
              className="w-28 px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-surface-800 dark:text-surface-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm" />
          </div>
        )}
      </div>
    </div>
  );

  const renderEnergyStep = () => (
    <div className="space-y-4">
      <EnergySlider label="Morgens (6–12 Uhr)" emoji="🌅" value={energy.energy_morning} onChange={(v) => setEnergy((e) => ({ ...e, energy_morning: v }))} />
      <EnergySlider label="Nachmittags (12–18 Uhr)" emoji="☀️" value={energy.energy_afternoon} onChange={(v) => setEnergy((e) => ({ ...e, energy_afternoon: v }))} />
      <EnergySlider label="Abends (18–24 Uhr)" emoji="🌙" value={energy.energy_evening} onChange={(v) => setEnergy((e) => ({ ...e, energy_evening: v }))} />

      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Ideale Lerneinheit-Dauer</label>
        <div className="flex items-center gap-4">
          <input type="range" min={15} max={120} step={5} value={energy.preferred_session_length}
            onChange={(e) => setEnergy((en) => ({ ...en, preferred_session_length: Number(e.target.value) }))}
            className="flex-1 h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer" />
          <span className="text-2xl font-bold text-brand-600 min-w-[5rem] text-right">{energy.preferred_session_length} min</span>
        </div>
      </div>

      <div>
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Konzentrationsfähigkeit</label>
        <div className="space-y-2.5">
          <OptionCard selected={energy.focus_challenge === "easily_distracted"} onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "easily_distracted" }))} label="Leicht abgelenkt" description="Brauche kurze Sessions und häufige Pausen" />
          <OptionCard selected={energy.focus_challenge === "moderate"} onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "moderate" }))} label="Durchschnittlich" description="Kann mich meistens gut konzentrieren" />
          <OptionCard selected={energy.focus_challenge === "very_focused"} onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "very_focused" }))} label="Sehr fokussiert" description="Kann lange am Stück arbeiten" />
        </div>
      </div>
    </div>
  );

  const renderLearningStyleStep = () => {
    const styles: { value: LearningStyleType; label: string; desc: string }[] = [
      { value: "visual", label: "Visuell", desc: "Diagramme, Videos, Mindmaps" },
      { value: "auditory", label: "Auditiv", desc: "Vorlesungen, Podcasts, Erklärungen" },
      { value: "reading", label: "Lesen/Schreiben", desc: "Texte lesen, Zusammenfassungen schreiben" },
      { value: "kinesthetic", label: "Praktisch", desc: "Übungen, Projekte, Ausprobieren" },
      { value: "mixed", label: "Gemischt", desc: "Kombination verschiedener Methoden" },
    ];

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Wie lernst du am besten?</label>
          <div className="space-y-2.5">
            {styles.map((s) => (
              <OptionCard key={s.value} selected={learningStyle.learning_style === s.value}
                onClick={() => setLearningStyle((ls) => ({ ...ls, learning_style: s.value }))}
                label={s.label} description={s.desc} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Welche Methoden nutzt du?</label>
          <div className="flex flex-wrap gap-2.5">
            <ToggleChip label="Lerngruppen" active={learningStyle.prefers_group_study} onClick={() => setLearningStyle((ls) => ({ ...ls, prefers_group_study: !ls.prefers_group_study }))} />
            <ToggleChip label="Karteikarten" active={learningStyle.uses_flashcards} onClick={() => setLearningStyle((ls) => ({ ...ls, uses_flashcards: !ls.uses_flashcards }))} />
            <ToggleChip label="Pomodoro-Timer" active={learningStyle.uses_pomodoro} onClick={() => setLearningStyle((ls) => ({ ...ls, uses_pomodoro: !ls.uses_pomodoro }))} />
            <ToggleChip label="Notizen schreiben" active={learningStyle.takes_notes} onClick={() => setLearningStyle((ls) => ({ ...ls, takes_notes: !ls.takes_notes }))} />
          </div>
        </div>
      </div>
    );
  };

  const renderSituationStep = () => (
    <div className="space-y-5">
      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">In welchem Semester bist du?</label>
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={14} value={situation.semester_number}
            onChange={(e) => setSituation((s) => ({ ...s, semester_number: Number(e.target.value) }))}
            className="flex-1 h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer" />
          <span className="text-2xl font-bold text-brand-600 min-w-[5rem] text-right">{situation.semester_number}. Sem.</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Wie viele Module belegst du?</label>
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={15} value={situation.modules_this_semester}
            onChange={(e) => setSituation((s) => ({ ...s, modules_this_semester: Number(e.target.value) }))}
            className="flex-1 h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer" />
          <span className="text-2xl font-bold text-brand-600 min-w-[4rem] text-right">{situation.modules_this_semester}</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700">
        <label className="block text-sm sm:text-base font-semibold text-surface-700 dark:text-surface-500 mb-3">Wie stark ist deine Prüfungsangst?</label>
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={5} value={situation.exam_anxiety_level}
            onChange={(e) => setSituation((s) => ({ ...s, exam_anxiety_level: Number(e.target.value) }))}
            className="flex-1 h-2.5 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 accent-brand-500 cursor-pointer" />
          <span className="text-sm font-semibold text-surface-600 min-w-[6rem] text-right">
            {["", "Kaum", "Etwas", "Mittel", "Stark", "Sehr stark"][situation.exam_anxiety_level]}
          </span>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderGoalsStep();
      case 1: return renderScheduleStep();
      case 2: return renderEnergyStep();
      case 3: return renderLearningStyleStep();
      case 4: return renderSituationStep();
      default: return null;
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const StepIcon = stepConfig.icon;

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Step indicator panel (desktop) */}
      <div className="hidden lg:flex lg:w-[360px] xl:w-[420px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-8 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Gem size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">Semetra</span>
          </div>

          <h2 className="text-xl font-bold mb-2">Personalisiere dein Lernerlebnis</h2>
          <p className="text-white/50 text-sm mb-10">5 kurze Schritte, damit Semetra perfekt zu dir passt.</p>

          {/* Step list */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={s.step} className={clsx(
                  "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                  isActive ? "bg-white dark:bg-surface-800/[0.08] border border-white/[0.1]" : "opacity-60"
                )}>
                  <div className={clsx(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    isDone ? "bg-green-500/20" : isActive ? `bg-gradient-to-br ${s.gradient} shadow-lg` : "bg-white dark:bg-surface-800/[0.06]"
                  )}>
                    {isDone ? <Check size={16} className="text-green-400" /> : <Icon size={16} className={isActive ? "text-white" : "text-white/40"} />}
                  </div>
                  <div>
                    <p className={clsx("text-sm font-medium", isActive ? "text-white" : isDone ? "text-white/70" : "text-white/40")}>{s.title}</p>
                    {isActive && <p className="text-xs text-white/40 mt-0.5">{s.subtitle}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mt-8">
          <p className="text-[11px] text-white/25">&copy; {new Date().getFullYear()} Lopicic Technologies</p>
        </div>
      </div>

      {/* RIGHT — Form area */}
      <div className="flex-1 flex flex-col bg-surface-50 dark:bg-surface-950 min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Gem size={16} className="text-white" />
            </div>
            <span className="text-base font-bold text-surface-800 dark:text-surface-800">Semetra Setup</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 sm:px-8 lg:px-12 pt-2 lg:pt-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              {Array.from({ length: STEPS.length }, (_, i) => (
                <div key={i} className={clsx(
                  "h-2 rounded-full flex-1 transition-all duration-500",
                  i < currentStep ? "bg-green-500" : i === currentStep ? "bg-brand-500" : "bg-surface-200 dark:bg-surface-800"
                )} />
              ))}
            </div>
            <p className="text-xs text-surface-400 text-right">Schritt {currentStep + 1} von {STEPS.length}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 sm:px-8 lg:px-12 py-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            {/* Step header */}
            <div className="flex items-center gap-4 mb-8">
              <div className={clsx("w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg", stepConfig.gradient)}>
                <StepIcon size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-surface-800 dark:text-white">{stepConfig.title}</h1>
                <p className="text-sm sm:text-base text-surface-500">{stepConfig.subtitle}</p>
              </div>
            </div>

            {/* Step content */}
            {renderCurrentStep()}

            {/* Error */}
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Bottom navigation — fixed on mobile */}
        <div className="sticky bottom-0 bg-surface-50/95 dark:bg-surface-950/95 backdrop-blur-lg border-t border-surface-200 dark:border-surface-800 px-4 sm:px-8 lg:px-12 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 0 || saving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 disabled:opacity-30 transition rounded-xl"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Zurück</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition px-3 py-2"
            >
              Überspringen
            </button>

            <button
              type="button"
              onClick={saveAndAdvance}
              disabled={!canGoNext() || saving}
              className={clsx(
                "flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl text-sm sm:text-base font-semibold text-white transition-all disabled:opacity-50 shadow-lg",
                isLastStep
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-500/25 hover:shadow-green-500/40"
                  : "bg-gradient-to-r from-brand-500 to-brand-600 shadow-brand-500/25 hover:shadow-brand-500/40"
              )}
            >
              {saving ? (
                <><Loader2 size={18} className="animate-spin" /> Speichern...</>
              ) : isLastStep ? (
                <><Check size={18} /> Abschliessen</>
              ) : (
                <>Weiter <ArrowRight size={18} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
