"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import {
  BookOpen, Sparkles, Brain, Target, Lightbulb, ArrowRight,
  ChevronLeft, ChevronRight, Loader2, RefreshCw, GraduationCap,
  Star, Zap, Info,
} from "lucide-react";
import Link from "next/link";

interface Overview {
  summary: string;
  prerequisites: string[];
  learningGoals: string[];
  realWorldUse: string;
}

interface TopicGuideEntry {
  title: string;
  explanation: string;
  relevance: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  order: number;
}

interface ConceptCard {
  title: string;
  definition: string;
  example: string;
  application: string;
  keyFormula?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface QuickStart {
  topThree: { title: string; why: string; howLong: string }[];
  recommendedOrder: string[];
  tips: string[];
}

interface LearningHub {
  overview: Overview;
  topicGuide: TopicGuideEntry[];
  conceptCards: ConceptCard[];
  quickStart: QuickStart;
  generatedAt: string;
  cached: boolean;
}

export default function ModuleLearningHub() {
  const { t } = useTranslation();
  const params = useParams();
  const moduleId = params?.id as string;
  const supabase = createClient();

  const [hub, setHub] = useState<LearningHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [moduleColor, setModuleColor] = useState("#6d28d9");
  const [activeTab, setActiveTab] = useState<"overview" | "topics" | "cards" | "start">("overview");
  const [cardIndex, setCardIndex] = useState(0);
  const [regenerating, setRegenerating] = useState(false);

  // Load module info
  useEffect(() => {
    if (!moduleId) return;
    supabase.from("modules").select("name, color").eq("id", moduleId).single()
      .then(({ data }) => {
        if (data) { setModuleName(data.name); setModuleColor(data.color ?? "#6d28d9"); }
      });
  }, [moduleId, supabase]);

  // Load learning hub
  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/learning-hub?moduleId=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.overview || data.topicGuide || data.conceptCards) {
          setHub(data);
        } else {
          setError("Lernraum hat keinen Inhalt. Versuche es mit 'Neu generieren'.");
        }
      } else if (res.status === 429) {
        setError("AI-Kontingent erschöpft. Versuche es später erneut.");
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Lernraum konnte nicht generiert werden.");
      }
    } catch {
      setError("Netzwerkfehler — bitte prüfe deine Verbindung.");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => { loadHub(); }, [loadHub]);

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/learning-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      if (res.ok) {
        setHub(await res.json());
      } else if (res.status === 429) {
        setError("AI-Kontingent erschöpft.");
      } else {
        setError("Generierung fehlgeschlagen. Versuche es erneut.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setRegenerating(false);
    }
  };

  const difficultyLabel = (d: string) =>
    d === "beginner" ? "Einsteiger" : d === "intermediate" ? "Fortgeschritten" : "Experte";
  const difficultyColor = (d: string) =>
    d === "beginner" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" :
    d === "intermediate" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/20" :
    "text-red-600 bg-red-50 dark:bg-red-950/20";

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-4" />
        <p className="text-surface-500">Lernraum wird vorbereitet...</p>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <BookOpen size={40} className="mx-auto mb-3 text-surface-300" />
        <p className="text-surface-900 dark:text-surface-50 font-semibold">
          {error ? "Lernraum nicht verfügbar" : "Lernraum wird erstellt..."}
        </p>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 max-w-md mx-auto">
            {error}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={loadHub} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            {error ? "Erneut versuchen" : "Generieren"}
          </button>
          <Link href={`/modules/${moduleId}`} className="px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-sm text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800 no-underline">
            Zurück zum Modul
          </Link>
        </div>
        {!error && (
          <p className="text-xs text-surface-400">Die erste Generierung kann 10-15 Sekunden dauern.</p>
        )}
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Überblick", icon: Info },
    { id: "topics" as const, label: "Themen-Leitfaden", icon: BookOpen },
    { id: "cards" as const, label: "Konzept-Karten", icon: Zap },
    { id: "start" as const, label: "Quick-Start", icon: Target },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/modules/${moduleId}`} className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600 no-underline mb-1">
            <ChevronLeft size={12} /> {moduleName}
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: moduleColor }}>
              <BookOpen size={16} />
            </div>
            Lernraum
          </h1>
          <p className="text-surface-500 text-sm mt-1">Allgemeines Verständnis — unabhängig von Prüfungen</p>
        </div>
        <button onClick={regenerate} disabled={regenerating}
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 disabled:opacity-50">
          <RefreshCw size={16} className={regenerating ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-50 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && hub.overview && (
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-5">
            <h2 className="font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-brand-500" /> Was ist {moduleName}?
            </h2>
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{hub.overview.summary}</p>
          </div>

          {hub.overview.realWorldUse && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10 p-4">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Praxisbezug</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">{hub.overview.realWorldUse}</p>
            </div>
          )}

          {hub.overview.prerequisites?.length > 0 && (
            <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
              <p className="text-xs font-medium text-surface-500 mb-2">Voraussetzungen</p>
              <div className="flex flex-wrap gap-2">
                {hub.overview.prerequisites.map((p, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">{p}</span>
                ))}
              </div>
            </div>
          )}

          {hub.overview.learningGoals?.length > 0 && (
            <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
              <p className="text-xs font-medium text-surface-500 mb-2">Lernziele</p>
              <div className="space-y-1.5">
                {hub.overview.learningGoals.map((g, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Target size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-surface-700 dark:text-surface-300">{g}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOPIC GUIDE TAB ── */}
      {activeTab === "topics" && hub.topicGuide && (
        <div className="space-y-3">
          {hub.topicGuide.sort((a, b) => a.order - b.order).map((topic, i) => (
            <div key={i} className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-500">{i + 1}</span>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50 text-sm">{topic.title}</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${difficultyColor(topic.difficulty)}`}>
                  {difficultyLabel(topic.difficulty)}
                </span>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">{topic.explanation}</p>
              <p className="text-xs text-surface-400 italic">{topic.relevance}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── CONCEPT CARDS TAB ── */}
      {activeTab === "cards" && hub.conceptCards && hub.conceptCards.length > 0 && (
        <div className="space-y-4">
          {/* Card Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCardIndex(Math.max(0, cardIndex - 1))} disabled={cardIndex === 0}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-surface-500">{cardIndex + 1} / {hub.conceptCards.length}</span>
            <button onClick={() => setCardIndex(Math.min(hub.conceptCards.length - 1, cardIndex + 1))} disabled={cardIndex >= hub.conceptCards.length - 1}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Active Card */}
          {(() => {
            const card = hub.conceptCards[cardIndex];
            return (
              <div className="rounded-2xl border-2 border-brand-200 dark:border-brand-800/40 bg-[rgb(var(--card-bg))] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-surface-900 dark:text-surface-50">{card.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${difficultyColor(card.difficulty)}`}>
                    {difficultyLabel(card.difficulty)}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-brand-500 uppercase tracking-wider mb-1">Definition</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{card.definition}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider mb-1">Beispiel</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{card.example}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-blue-500 uppercase tracking-wider mb-1">Anwendung</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{card.application}</p>
                </div>

                {card.keyFormula && (
                  <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-surface-500 mb-1">Formel</p>
                    <p className="text-sm font-mono text-surface-800 dark:text-surface-200">{card.keyFormula}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Card Dots */}
          <div className="flex justify-center gap-1.5">
            {hub.conceptCards.map((_, i) => (
              <button key={i} onClick={() => setCardIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === cardIndex ? "bg-brand-500 scale-125" : "bg-surface-300 dark:bg-surface-600"}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── QUICK START TAB ── */}
      {activeTab === "start" && hub.quickStart && (
        <div className="space-y-4">
          {hub.quickStart.topThree?.length > 0 && (
            <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-5">
              <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
                <Star size={16} className="text-amber-500" /> Top 3 — Damit anfangen
              </h3>
              <div className="space-y-3">
                {hub.quickStart.topThree.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{item.title}</p>
                      <p className="text-xs text-surface-500">{item.why} · {item.howLong}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hub.quickStart.tips?.length > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10 p-4">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                <Lightbulb size={12} /> Lerntipps
              </p>
              <div className="space-y-1.5">
                {hub.quickStart.tips.map((tip, i) => (
                  <p key={i} className="text-sm text-emerald-700 dark:text-emerald-300">• {tip}</p>
                ))}
              </div>
            </div>
          )}

          {hub.quickStart.recommendedOrder?.length > 0 && (
            <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-4">
              <p className="text-xs font-medium text-surface-500 mb-2">Empfohlene Reihenfolge</p>
              <div className="flex flex-wrap gap-1.5">
                {hub.quickStart.recommendedOrder.map((topic, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                    <span className="text-[10px] text-surface-400">{i + 1}.</span> {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Link to Timer */}
          <Link href={`/guided-session?module=${moduleId}`}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors no-underline">
            <Brain size={16} /> Lernsession starten
          </Link>
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-surface-400 text-center">
        Dieser Lernraum dient dem allgemeinen Verständnis. Prüfungsrelevanter Stoff wird separat verwaltet.
        {hub.cached && ` · Generiert am ${new Date(hub.generatedAt).toLocaleDateString("de-CH")}`}
      </p>
    </div>
  );
}
