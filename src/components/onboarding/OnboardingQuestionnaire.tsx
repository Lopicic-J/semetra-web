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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// ── Types ────────────────────────────────────────────────────────────────────

interface StepConfig {
  step: number;
  step_name: string;
  title: string;
  subtitle: string;
  icon: typeof Target;
}

const STEPS: StepConfig[] = [
  { step: 1, step_name: "goals", title: "Deine Lernziele", subtitle: "Was möchtest du mit Semetra erreichen?", icon: Target },
  { step: 2, step_name: "schedule", title: "Dein Zeitplan", subtitle: "Wann hast du Zeit zum Lernen?", icon: Clock },
  { step: 3, step_name: "energy", title: "Energie & Fokus", subtitle: "Wann bist du am produktivsten?", icon: Zap },
  { step: 4, step_name: "learning_style", title: "Dein Lernstil", subtitle: "Wie lernst du am liebsten?", icon: Brain },
  { step: 5, step_name: "situation", title: "Deine Situation", subtitle: "Wo stehst du gerade im Studium?", icon: BookOpen },
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

const defaultGoals: GoalsData = {
  primary_goal: "pass_exams",
  weekly_study_target_hours: 20,
};

const defaultSchedule: ScheduleData = {
  wake_time: "07:00",
  sleep_time: "23:00",
  available_from: "08:00",
  available_until: "20:00",
  busy_days: [],
  has_job: false,
  job_hours_per_week: 0,
};

const defaultEnergy: EnergyData = {
  energy_morning: 3,
  energy_afternoon: 3,
  energy_evening: 3,
  preferred_session_length: 45,
  focus_challenge: "moderate",
};

const defaultLearningStyle: LearningStyleData = {
  learning_style: "mixed",
  prefers_group_study: false,
  uses_flashcards: false,
  uses_pomodoro: false,
  takes_notes: true,
};

const defaultSituation: SituationData = {
  semester_number: 1,
  modules_this_semester: 6,
  exam_anxiety_level: 3,
};

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
        "w-full text-left p-4 rounded-xl border-2 transition-all duration-150",
        selected
          ? "border-brand-500 bg-brand-50 shadow-sm"
          : "border-surface-200 bg-[rgb(var(--card-bg))] hover:border-surface-300"
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            selected ? "bg-brand-100 text-brand-600" : "bg-surface-100 text-surface-500"
          )}>
            <Icon size={18} />
          </div>
        )}
        <div>
          <p className={clsx("font-medium text-sm", selected ? "text-brand-700" : "text-surface-700")}>{label}</p>
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
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
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-surface-700">
          {emoji} {label}
        </span>
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
      <div className="flex justify-between text-xs text-surface-400">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
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
        "px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border",
        active
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-[rgb(var(--card-bg))] text-surface-600 border-surface-200 hover:border-surface-300"
      )}
    >
      {label}
    </button>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 flex items-center gap-1">
          <div
            className={clsx(
              "h-1.5 rounded-full w-full transition-all duration-300",
              i < current ? "bg-brand-500" : i === current ? "bg-brand-300" : "bg-surface-200"
            )}
          />
        </div>
      ))}
      <span className="text-xs text-surface-500 ml-1 whitespace-nowrap">
        {current + 1}/{total}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingQuestionnaire() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step data
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

  /** Build flat data object matching onboarding_responses columns */
  const buildFlatData = useCallback((): Record<string, unknown> => {
    // Map frontend values → DB CHECK constraint values
    const goalMap: Record<string, string> = {
      pass_exams: "exam_prep",
      improve_grades: "improve_grades",
      time_management: "save_time",
      reduce_stress: "reduce_stress",
      learn_efficiently: "build_habits",
    };

    const focusMap: Record<string, string> = {
      easily_distracted: "phone",       // most common distraction source
      moderate: "none",                  // no major challenge
      very_focused: "none",             // no challenge
    };

    const sessionLengthMap = (minutes: number): string => {
      if (minutes <= 30) return "short";
      if (minutes <= 60) return "medium";
      return "long";
    };

    return {
      // Step 1: Goals
      primary_goal: goalMap[goals.primary_goal] ?? "explore",
      weekly_study_target_hours: goals.weekly_study_target_hours,
      // Step 2: Schedule
      typical_wake_time: schedule.wake_time,
      typical_sleep_time: schedule.sleep_time,
      available_from: schedule.available_from,
      available_until: schedule.available_until,
      busy_days: schedule.busy_days,
      has_job: schedule.has_job,
      job_hours_per_week: schedule.job_hours_per_week,
      // Step 3: Energy
      energy_morning: energy.energy_morning,
      energy_afternoon: energy.energy_afternoon,
      energy_evening: energy.energy_evening,
      preferred_session_length: sessionLengthMap(energy.preferred_session_length),
      focus_challenge: focusMap[energy.focus_challenge] ?? "none",
      // Step 4: Learning Style
      learning_style: learningStyle.learning_style,
      prefers_group_study: learningStyle.prefers_group_study,
      uses_flashcards: learningStyle.uses_flashcards,
      uses_pomodoro: learningStyle.uses_pomodoro,
      uses_notes: learningStyle.takes_notes,
      // Step 5: Situation
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
    { value: "Mo", label: "Mo" },
    { value: "Di", label: "Di" },
    { value: "Mi", label: "Mi" },
    { value: "Do", label: "Do" },
    { value: "Fr", label: "Fr" },
    { value: "Sa", label: "Sa" },
    { value: "So", label: "So" },
  ];

  const renderGoalsStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-3">Was ist dein Hauptziel?</label>
        <div className="space-y-2">
          {GOAL_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              selected={goals.primary_goal === opt.value}
              onClick={() => setGoals((g) => ({ ...g, primary_goal: opt.value }))}
              label={opt.label}
              description={opt.desc}
              icon={opt.icon}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-2">
          Wie viele Stunden pro Woche möchtest du lernen?
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={goals.weekly_study_target_hours}
            onChange={(e) => setGoals((g) => ({ ...g, weekly_study_target_hours: Number(e.target.value) }))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
          />
          <span className="text-lg font-semibold text-brand-600 min-w-[4rem] text-right">
            {goals.weekly_study_target_hours}h
          </span>
        </div>
        <div className="flex justify-between text-xs text-surface-400 mt-1">
          <span>5h</span>
          <span>Wenig</span>
          <span>Mittel</span>
          <span>Viel</span>
          <span>60h</span>
        </div>
      </div>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Aufstehzeit</label>
          <input
            type="time"
            value={schedule.wake_time}
            onChange={(e) => setSchedule((s) => ({ ...s, wake_time: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Schlafenszeit</label>
          <input
            type="time"
            value={schedule.sleep_time}
            onChange={(e) => setSchedule((s) => ({ ...s, sleep_time: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Lernzeit ab</label>
          <input
            type="time"
            value={schedule.available_from}
            onChange={(e) => setSchedule((s) => ({ ...s, available_from: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Lernzeit bis</label>
          <input
            type="time"
            value={schedule.available_until}
            onChange={(e) => setSchedule((s) => ({ ...s, available_until: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-2">
          An welchen Tagen bist du oft beschäftigt (Vorlesungen, Arbeit)?
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <ToggleChip
              key={day.value}
              label={day.label}
              active={schedule.busy_days.includes(day.value)}
              onClick={() =>
                setSchedule((s) => ({
                  ...s,
                  busy_days: s.busy_days.includes(day.value)
                    ? s.busy_days.filter((d) => d !== day.value)
                    : [...s.busy_days, day.value],
                }))
              }
            />
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.has_job}
            onChange={(e) => setSchedule((s) => ({ ...s, has_job: e.target.checked, job_hours_per_week: e.target.checked ? s.job_hours_per_week : 0 }))}
            className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-sm text-surface-700">Ich arbeite neben dem Studium</span>
        </label>
        {schedule.has_job && (
          <div className="mt-3 ml-7">
            <label className="block text-sm text-surface-600 mb-1">Stunden pro Woche</label>
            <input
              type="number"
              min={1}
              max={40}
              value={schedule.job_hours_per_week}
              onChange={(e) => setSchedule((s) => ({ ...s, job_hours_per_week: Number(e.target.value) }))}
              className="w-24 px-3 py-2 rounded-xl border border-surface-200 bg-[rgb(var(--card-bg))] text-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderEnergyStep = () => (
    <div className="space-y-6">
      <EnergySlider
        label="Morgens (6–12 Uhr)"
        emoji="🌅"
        value={energy.energy_morning}
        onChange={(v) => setEnergy((e) => ({ ...e, energy_morning: v }))}
      />
      <EnergySlider
        label="Nachmittags (12–18 Uhr)"
        emoji="☀️"
        value={energy.energy_afternoon}
        onChange={(v) => setEnergy((e) => ({ ...e, energy_afternoon: v }))}
      />
      <EnergySlider
        label="Abends (18–24 Uhr)"
        emoji="🌙"
        value={energy.energy_evening}
        onChange={(v) => setEnergy((e) => ({ ...e, energy_evening: v }))}
      />

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-2">
          Ideale Lerneinheit-Dauer (Minuten)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={15}
            max={120}
            step={5}
            value={energy.preferred_session_length}
            onChange={(e) => setEnergy((en) => ({ ...en, preferred_session_length: Number(e.target.value) }))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
          />
          <span className="text-lg font-semibold text-brand-600 min-w-[4rem] text-right">
            {energy.preferred_session_length} min
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-3">Wie gut kannst du dich konzentrieren?</label>
        <div className="space-y-2">
          <OptionCard
            selected={energy.focus_challenge === "easily_distracted"}
            onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "easily_distracted" }))}
            label="Leicht abgelenkt"
            description="Brauche kurze Sessions und häufige Pausen"
          />
          <OptionCard
            selected={energy.focus_challenge === "moderate"}
            onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "moderate" }))}
            label="Durchschnittlich"
            description="Kann mich meistens gut konzentrieren"
          />
          <OptionCard
            selected={energy.focus_challenge === "very_focused"}
            onClick={() => setEnergy((e) => ({ ...e, focus_challenge: "very_focused" }))}
            label="Sehr fokussiert"
            description="Kann lange am Stück arbeiten"
          />
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
          <label className="block text-sm font-medium text-surface-700 mb-3">Wie lernst du am besten?</label>
          <div className="space-y-2">
            {styles.map((s) => (
              <OptionCard
                key={s.value}
                selected={learningStyle.learning_style === s.value}
                onClick={() => setLearningStyle((ls) => ({ ...ls, learning_style: s.value }))}
                label={s.label}
                description={s.desc}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-3">Welche Methoden nutzt du?</label>
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              label="Lerngruppen"
              active={learningStyle.prefers_group_study}
              onClick={() => setLearningStyle((ls) => ({ ...ls, prefers_group_study: !ls.prefers_group_study }))}
            />
            <ToggleChip
              label="Karteikarten"
              active={learningStyle.uses_flashcards}
              onClick={() => setLearningStyle((ls) => ({ ...ls, uses_flashcards: !ls.uses_flashcards }))}
            />
            <ToggleChip
              label="Pomodoro-Timer"
              active={learningStyle.uses_pomodoro}
              onClick={() => setLearningStyle((ls) => ({ ...ls, uses_pomodoro: !ls.uses_pomodoro }))}
            />
            <ToggleChip
              label="Notizen schreiben"
              active={learningStyle.takes_notes}
              onClick={() => setLearningStyle((ls) => ({ ...ls, takes_notes: !ls.takes_notes }))}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderSituationStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">In welchem Semester bist du?</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={14}
            value={situation.semester_number}
            onChange={(e) => setSituation((s) => ({ ...s, semester_number: Number(e.target.value) }))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
          />
          <span className="text-lg font-semibold text-brand-600 min-w-[4rem] text-right">
            {situation.semester_number}. Sem.
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">Wie viele Module belegst du dieses Semester?</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={15}
            value={situation.modules_this_semester}
            onChange={(e) => setSituation((s) => ({ ...s, modules_this_semester: Number(e.target.value) }))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
          />
          <span className="text-lg font-semibold text-brand-600 min-w-[4rem] text-right">
            {situation.modules_this_semester}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-2">Wie stark ist deine Prüfungsangst?</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={5}
            value={situation.exam_anxiety_level}
            onChange={(e) => setSituation((s) => ({ ...s, exam_anxiety_level: Number(e.target.value) }))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-200 accent-brand-500"
          />
          <span className="text-sm text-surface-600 min-w-[6rem] text-right">
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
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-brand-600 mb-2">
            <Sparkles size={20} />
            <span className="text-sm font-medium">Semetra Onboarding</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-800">Personalisiere dein Lernerlebnis</h1>
          <p className="text-sm text-surface-500 mt-1">5 kurze Schritte, damit Semetra perfekt zu dir passt</p>
        </div>

        <ProgressBar current={currentStep} total={STEPS.length} />

        <Card padding="lg" className="mb-4">
          {/* Step header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
              <StepIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-800">{stepConfig.title}</h2>
              <p className="text-sm text-surface-500">{stepConfig.subtitle}</p>
            </div>
          </div>

          {/* Step content */}
          {renderCurrentStep()}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-danger-50 border border-danger-100 text-sm text-danger-700">
              {error}
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="md"
            onClick={goBack}
            disabled={currentStep === 0 || saving}
          >
            <ArrowLeft size={16} />
            Zurück
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={saveAndAdvance}
            disabled={!canGoNext() || saving}
            loading={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Speichern...
              </>
            ) : isLastStep ? (
              <>
                Abschliessen
                <Check size={16} />
              </>
            ) : (
              <>
                Weiter
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>

        {/* Skip option */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
          >
            Überspringen und später einrichten
          </button>
        </div>
      </div>
    </div>
  );
}
