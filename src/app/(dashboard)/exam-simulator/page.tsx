"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import {
  GraduationCap, Play, CheckCircle2, XCircle, Clock,
  ChevronRight, RotateCcw, Trophy, AlertTriangle, Target,
} from "lucide-react";
import Link from "next/link";

interface Question {
  question: string;
  type: "multiple_choice" | "open";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

type Phase = "setup" | "loading" | "exam" | "results";

export default function ExamSimulatorPage() {
  const { modules } = useModules();
  const { isPro } = useProfile();
  const searchParams = useSearchParams();
  const paramModule = searchParams.get("module");

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedModule, setSelectedModule] = useState(paramModule ?? "");
  const [difficulty, setDifficulty] = useState<"easy" | "mixed" | "hard">("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { answer: string; correct: boolean | null }>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [openAnswer, setOpenAnswer] = useState("");

  const activeModules = modules.filter(m => m.status === "active" || m.status === "planned" || m.status === "completed");
  const currentQuestion = questions[currentIndex];
  const moduleName = modules.find(m => m.id === selectedModule)?.name ?? "";

  const startExam = useCallback(async () => {
    if (!selectedModule) return;
    setPhase("loading");

    try {
      const res = await fetch("/api/ai/exam-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: selectedModule, questionCount, difficulty }),
      });

      if (!res.ok) {
        setPhase("setup");
        return;
      }

      const data = await res.json();
      if (data.questions?.length > 0) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setAnswers({});
        setPhase("exam");
      } else {
        setPhase("setup");
      }
    } catch {
      setPhase("setup");
    }
  }, [selectedModule, questionCount, difficulty]);

  const submitMCAnswer = (option: string) => {
    if (answers[currentIndex]) return; // Already answered
    const correct = option === currentQuestion.correctAnswer;
    setAnswers(prev => ({ ...prev, [currentIndex]: { answer: option, correct } }));
    setShowExplanation(true);
  };

  const submitOpenAnswer = () => {
    if (!openAnswer.trim() || answers[currentIndex]) return;
    // For open questions, mark as pending (needs review)
    setAnswers(prev => ({ ...prev, [currentIndex]: { answer: openAnswer, correct: null } }));
    setShowExplanation(true);
    setOpenAnswer("");
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setPhase("results");
    }
  };

  const restart = () => {
    setPhase("setup");
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setShowExplanation(false);
  };

  // Results calculation
  const totalAnswered = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter(a => a.correct === true).length;
  const wrongCount = Object.values(answers).filter(a => a.correct === false).length;
  const openCount = Object.values(answers).filter(a => a.correct === null).length;
  const score = totalAnswered > 0 ? Math.round((correctCount / (totalAnswered - openCount || 1)) * 100) : 0;
  const estimatedGrade = Math.round((score / 100 * 5 + 1) * 10) / 10; // 0%→1.0, 100%→6.0

  // Weak topics from wrong answers
  const weakTopics = [...new Set(
    Object.entries(answers)
      .filter(([, a]) => a.correct === false)
      .map(([i]) => questions[parseInt(i)]?.topic)
      .filter(Boolean)
  )];

  // ── SETUP PHASE ──
  if (phase === "setup") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2 mb-6">
          <GraduationCap size={28} className="text-brand-500" />
          Prüfungssimulator
        </h1>

        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-6 space-y-5">
          {/* Module Selection */}
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Modul wählen</label>
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
            >
              <option value="">Modul auswählen...</option>
              {activeModules.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Schwierigkeit</label>
            <div className="grid grid-cols-3 gap-2">
              {([["easy", "Leicht", "Verständnisfragen"], ["mixed", "Gemischt", "Mix aus allen"], ["hard", "Schwer", "Analyse & Transfer"]] as const).map(([val, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setDifficulty(val)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    difficulty === val
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                      : "border-surface-200 dark:border-surface-700 hover:border-surface-300"
                  }`}
                >
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{label}</p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Anzahl Fragen</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    questionCount === n
                      ? "bg-brand-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startExam}
            disabled={!selectedModule}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={18} fill="white" /> Prüfung starten
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ──
  if (phase === "loading") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <GraduationCap size={32} className="text-brand-500" />
        </div>
        <p className="text-lg font-semibold text-surface-900 dark:text-surface-50">Prüfung wird generiert...</p>
        <p className="text-sm text-surface-500 mt-2">KI erstellt {questionCount} Fragen für {moduleName}</p>
      </div>
    );
  }

  // ── EXAM PHASE ──
  if (phase === "exam" && currentQuestion) {
    const answered = answers[currentIndex];
    const diffColors = { easy: "text-emerald-600 bg-emerald-50", medium: "text-amber-600 bg-amber-50", hard: "text-red-600 bg-red-50" };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium text-surface-500">{currentIndex + 1}/{questions.length}</span>
          <div className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${diffColors[currentQuestion.difficulty]}`}>
            {currentQuestion.difficulty === "easy" ? "Leicht" : currentQuestion.difficulty === "medium" ? "Mittel" : "Schwer"}
          </span>
        </div>

        {/* Question */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-6 mb-4">
          <p className="text-xs text-surface-400 mb-2">
            {currentQuestion.topic}
          </p>
          <p className="text-lg font-medium text-surface-900 dark:text-surface-50 leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>

        {/* Answer Options */}
        {currentQuestion.type === "multiple_choice" && currentQuestion.options ? (
          <div className="space-y-2 mb-4">
            {currentQuestion.options.map((option, i) => {
              const isSelected = answered?.answer === option;
              const isCorrect = option === currentQuestion.correctAnswer;
              const showResult = !!answered;

              return (
                <button
                  key={i}
                  onClick={() => submitMCAnswer(option)}
                  disabled={!!answered}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    showResult && isCorrect
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                      : showResult && isSelected && !isCorrect
                        ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                        : "border-surface-200 dark:border-surface-700 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-semibold text-surface-600 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-surface-800 dark:text-surface-200 flex-1">{option}</span>
                    {showResult && isCorrect && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle size={18} className="text-red-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Open Question */
          <div className="mb-4">
            <textarea
              value={answered ? answered.answer : openAnswer}
              onChange={e => setOpenAnswer(e.target.value)}
              disabled={!!answered}
              placeholder="Deine Antwort..."
              className="w-full p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm min-h-[120px] resize-none"
            />
            {!answered && (
              <button
                onClick={submitOpenAnswer}
                disabled={openAnswer.trim().length < 10}
                className="mt-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                Antwort abgeben
              </button>
            )}
          </div>
        )}

        {/* Explanation */}
        {showExplanation && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20 p-4 mb-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Erklärung</p>
            <p className="text-sm text-blue-800 dark:text-blue-200">{currentQuestion.explanation}</p>
            {currentQuestion.type === "open" && (
              <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-700/30">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Musterantwort</p>
                <p className="text-sm text-blue-800 dark:text-blue-200">{currentQuestion.correctAnswer}</p>
              </div>
            )}
          </div>
        )}

        {/* Next Button */}
        {answered && (
          <button
            onClick={nextQuestion}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 font-semibold hover:opacity-90 transition-opacity"
          >
            {currentIndex < questions.length - 1 ? (
              <>Nächste Frage <ChevronRight size={18} /></>
            ) : (
              <>Ergebnis anzeigen <Trophy size={18} /></>
            )}
          </button>
        )}
      </div>
    );
  }

  // ── RESULTS PHASE ──
  if (phase === "results") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Score Card */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-6 text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            score >= 70 ? "bg-emerald-100 dark:bg-emerald-900/30" :
            score >= 50 ? "bg-amber-100 dark:bg-amber-900/30" :
            "bg-red-100 dark:bg-red-900/30"
          }`}>
            {score >= 70 ? <Trophy size={36} className="text-emerald-600" /> :
             score >= 50 ? <Target size={36} className="text-amber-600" /> :
             <AlertTriangle size={36} className="text-red-600" />}
          </div>
          <p className="text-3xl font-bold text-surface-900 dark:text-surface-50">{score}%</p>
          <p className="text-surface-500 mt-1">{moduleName}</p>
          <p className="text-sm text-surface-400 mt-2">
            {correctCount} richtig · {wrongCount} falsch{openCount > 0 ? ` · ${openCount} offen` : ""}
          </p>
          <div className="mt-3 inline-block px-4 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800">
            <span className="text-sm text-surface-600">Geschätzte Note: </span>
            <span className={`text-lg font-bold ${estimatedGrade >= 4.0 ? "text-emerald-600" : "text-red-600"}`}>
              {estimatedGrade.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Weak Topics */}
        {weakTopics.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
              Schwache Themen — hier solltest du nacharbeiten:
            </p>
            <div className="flex flex-wrap gap-2">
              {weakTopics.map(topic => (
                <span key={topic} className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-200 dark:border-surface-700 font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
            <RotateCcw size={16} /> Nochmal versuchen
          </button>
          <Link href={`/timer?module=${selectedModule}`} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors no-underline">
            <Clock size={16} /> Jetzt lernen
          </Link>
        </div>

        {/* Question Review */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Fragen-Überblick</p>
          {questions.map((q, i) => {
            const a = answers[i];
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                a?.correct === true ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/10" :
                a?.correct === false ? "border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/10" :
                "border-surface-200 dark:border-surface-700"
              }`}>
                <span className="mt-0.5 shrink-0">
                  {a?.correct === true ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                   a?.correct === false ? <XCircle size={16} className="text-red-500" /> :
                   <Clock size={16} className="text-surface-400" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-surface-800 dark:text-surface-200 line-clamp-2">{q.question}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{q.topic}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
