"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTranslation } from "@/lib/i18n";
import {
  Sparkles, Check, Square, CheckSquare, Plus, X, Loader2,
  ArrowRight, SkipForward, BookOpen, Zap, ChevronDown, ChevronUp,
} from "lucide-react";

interface TopicSuggestion {
  title: string;
  description: string;
  difficulty: string;
  selected: boolean;
}

interface ModuleSetup {
  moduleId: string;
  moduleName: string;
  moduleColor?: string;
  ects: number;
  status: "pending" | "loading" | "ready" | "applying" | "done" | "skipped";
  topics: TopicSuggestion[];
  flashcardCount: number;
  resourceCount: number;
  learningRecommendation: string;
  customTopic: string;
  expanded: boolean;
}

export default function ModuleSetupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { modules, refetch } = useModules();

  const [setups, setSetups] = useState<ModuleSetup[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [loading, setLoading] = useState(true);

  // Find modules without topics
  useEffect(() => {
    if (modules.length === 0) return;

    const supabaseClient = createClient();

    // Check which modules actually have no topics — only show those
    async function checkModules() {
      const activeModules = modules.filter(m => m.status === "active" || m.status === "planned");
      const setupList: ModuleSetup[] = [];

      for (const mod of activeModules) {
        const { count } = await supabaseClient
          .from("topics")
          .select("id", { count: "exact", head: true })
          .eq("module_id", mod.id);

        // Only include modules with 0 topics
        if ((count ?? 0) === 0) {
          setupList.push({
            moduleId: mod.id,
            moduleName: mod.name,
            moduleColor: mod.color ?? undefined,
            ects: mod.ects ?? 0,
            status: "pending",
            topics: [],
            flashcardCount: 0,
            resourceCount: 0,
            learningRecommendation: "",
            customTopic: "",
            expanded: false,
          });
        }
      }

      if (setupList.length === 0) {
        // All modules already have topics
        setAllDone(true);
      }

      setSetups(setupList);
      setLoading(false);
    }

    checkModules();
  }, [modules]);

  const generateForModule = useCallback(async (index: number) => {
    setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "loading" } : s));

    try {
      const setup = setups[index];
      const res = await fetch("/api/ai/module-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleName: setup.moduleName,
          ects: setup.ects,
          moduleType: "mixed",
        }),
      });

      if (!res.ok) {
        setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "pending" } : s));
        return;
      }

      const data = await res.json();
      setSetups(prev => prev.map((s, i) => i === index ? {
        ...s,
        status: "ready",
        topics: (data.topics ?? []).map((tp: any) => ({ ...tp, selected: true })),
        flashcardCount: data.flashcards?.length ?? 0,
        resourceCount: data.resources?.length ?? 0,
        learningRecommendation: data.learningRecommendation ?? "",
        expanded: true,
      } : s));
    } catch {
      setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "pending" } : s));
    }
  }, [setups]);

  const toggleTopic = (moduleIndex: number, topicIndex: number) => {
    setSetups(prev => prev.map((s, i) => {
      if (i !== moduleIndex) return s;
      const topics = [...s.topics];
      topics[topicIndex] = { ...topics[topicIndex], selected: !topics[topicIndex].selected };
      return { ...s, topics };
    }));
  };

  const addCustomTopic = (moduleIndex: number) => {
    setSetups(prev => prev.map((s, i) => {
      if (i !== moduleIndex || !s.customTopic.trim()) return s;
      return {
        ...s,
        topics: [...s.topics, { title: s.customTopic.trim(), description: "", difficulty: "medium", selected: true }],
        customTopic: "",
      };
    }));
  };

  const applyModule = useCallback(async (index: number) => {
    const setup = setups[index];
    const selectedTopics = setup.topics.filter(tp => tp.selected);

    if (selectedTopics.length === 0) {
      // Skip if nothing selected
      setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "skipped" } : s));
      return;
    }

    setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "applying" } : s));

    try {
      const res = await fetch("/api/ai/module-setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: setup.moduleId,
          topics: selectedTopics,
          flashcards: [], // Flashcards only for selected topics — handled server-side
          learningRecommendation: setup.learningRecommendation,
        }),
      });

      if (res.ok) {
        setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "done" } : s));
      } else {
        setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "ready" } : s));
      }
    } catch {
      setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "ready" } : s));
    }
  }, [setups]);

  const skipModule = (index: number) => {
    setSetups(prev => prev.map((s, i) => i === index ? { ...s, status: "skipped" } : s));
  };

  const toggleExpand = (index: number) => {
    setSetups(prev => prev.map((s, i) => i === index ? { ...s, expanded: !s.expanded } : s));
  };

  // Check if all done
  useEffect(() => {
    if (setups.length > 0 && setups.every(s => s.status === "done" || s.status === "skipped")) {
      setAllDone(true);
    }
  }, [setups]);

  const finishSetup = () => {
    refetch();
    router.push("/dashboard");
  };

  const doneCount = setups.filter(s => s.status === "done").length;
  const skippedCount = setups.filter(s => s.status === "skipped").length;
  const totalCount = setups.length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-4" />
        <p className="text-surface-500">{t("moduleSetup.loading") || "Module werden geladen..."}</p>
      </div>
    );
  }

  // ── ALL DONE ──
  if (allDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
          <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
            {t("moduleSetup.complete") || "Einrichtung abgeschlossen!"}
          </h1>
          <p className="text-surface-500 mt-2">
            {doneCount > 0 && `${doneCount} ${doneCount === 1 ? "Modul" : "Module"} eingerichtet`}
            {skippedCount > 0 && ` · ${skippedCount} übersprungen`}
          </p>
          <p className="text-sm text-surface-400 mt-1">
            {t("moduleSetup.completeHint") || "Du kannst jederzeit weitere Topics und Flashcards in den einzelnen Modulen hinzufügen."}
          </p>
        </div>
        <button
          onClick={finishSetup}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
        >
          {t("moduleSetup.toDashboard") || "Zum Dashboard"} <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  // ── SETUP FLOW ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
          <Sparkles size={28} className="text-brand-500" />
          {t("moduleSetup.title") || "Module einrichten"}
        </h1>
        <p className="text-surface-500 mt-1">
          {t("moduleSetup.subtitle") || "Wähle für jedes Modul die passenden Topics aus. Die KI schlägt vor — du entscheidest."}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? ((doneCount + skippedCount) / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-surface-400">{doneCount + skippedCount}/{totalCount}</span>
        </div>
      </div>

      {/* Module List */}
      <div className="space-y-3">
        {setups.map((setup, index) => (
          <div
            key={setup.moduleId}
            className={`rounded-xl border overflow-hidden transition-all ${
              setup.status === "done" ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10" :
              setup.status === "skipped" ? "border-surface-200 dark:border-surface-700 opacity-50" :
              setup.expanded ? "border-brand-200 dark:border-brand-800/40 bg-[rgb(var(--card-bg))]" :
              "border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))]"
            }`}
          >
            {/* Module Header */}
            <div className="flex items-center gap-3 p-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: setup.moduleColor ?? "#6d28d9" }}
              >
                {setup.status === "done" ? <Check size={14} /> :
                 setup.status === "skipped" ? <SkipForward size={12} /> :
                 <BookOpen size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-900 dark:text-surface-50 text-sm truncate">{setup.moduleName}</p>
                <p className="text-[10px] text-surface-400">
                  {setup.ects > 0 && `${setup.ects} ECTS`}
                  {setup.status === "done" && ` · ${setup.topics.filter(tp => tp.selected).length} Topics erstellt`}
                  {setup.status === "skipped" && " · Übersprungen"}
                </p>
              </div>

              {/* Actions based on status */}
              {setup.status === "pending" && (
                <button
                  onClick={() => generateForModule(index)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-950/30 transition-colors"
                >
                  <Sparkles size={12} /> {t("moduleSetup.generate") || "Vorschlagen"}
                </button>
              )}
              {setup.status === "loading" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-500">
                  <Loader2 size={12} className="animate-spin" /> {t("ai.analyzing") || "Wird analysiert..."}
                </div>
              )}
              {(setup.status === "ready" || setup.status === "applying") && (
                <button onClick={() => toggleExpand(index)} className="text-surface-400 hover:text-surface-600 p-1">
                  {setup.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              )}
              {setup.status === "pending" && (
                <button onClick={() => skipModule(index)} className="text-xs text-surface-400 hover:text-surface-600 px-2 py-1">
                  {t("moduleSetup.skip") || "Überspringen"}
                </button>
              )}
            </div>

            {/* Expanded Content — Topic Selection */}
            {setup.expanded && (setup.status === "ready" || setup.status === "applying") && (
              <div className="border-t border-surface-100 dark:border-surface-800 px-4 py-3 space-y-3">
                {/* Learning Recommendation */}
                {setup.learningRecommendation && (
                  <p className="text-xs text-brand-600 dark:text-brand-400 italic bg-brand-50/50 dark:bg-brand-950/10 rounded-lg p-2">
                    {setup.learningRecommendation}
                  </p>
                )}

                {/* Topic Checkboxes */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                    {t("moduleSetup.selectTopics") || "Topics auswählen"} ({setup.topics.filter(tp => tp.selected).length}/{setup.topics.length})
                  </p>
                  {setup.topics.map((topic, tIndex) => (
                    <button
                      key={tIndex}
                      onClick={() => toggleTopic(index, tIndex)}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                        topic.selected
                          ? "bg-brand-50/50 dark:bg-brand-950/10"
                          : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
                      }`}
                    >
                      {topic.selected
                        ? <CheckSquare size={15} className="text-brand-500 mt-0.5 shrink-0" />
                        : <Square size={15} className="text-surface-300 mt-0.5 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className={`text-sm ${topic.selected ? "text-surface-900 dark:text-surface-100" : "text-surface-500 line-through"}`}>
                          {topic.title}
                        </p>
                        {topic.description && (
                          <p className="text-[10px] text-surface-400 mt-0.5">{topic.description}</p>
                        )}
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        topic.difficulty === "easy" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                        topic.difficulty === "hard" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                        "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      }`}>
                        {topic.difficulty === "easy" ? "Leicht" : topic.difficulty === "hard" ? "Schwer" : "Mittel"}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Add Custom Topic */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={setup.customTopic}
                    onChange={e => setSetups(prev => prev.map((s, i) => i === index ? { ...s, customTopic: e.target.value } : s))}
                    placeholder={t("moduleSetup.addCustom") || "Eigenes Topic hinzufügen..."}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-xs"
                    onKeyDown={e => e.key === "Enter" && addCustomTopic(index)}
                  />
                  <button
                    onClick={() => addCustomTopic(index)}
                    disabled={!setup.customTopic.trim()}
                    className="px-2 py-1.5 rounded-lg text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Info about flashcards */}
                <p className="text-[10px] text-surface-400 flex items-center gap-1">
                  <Zap size={10} /> {t("moduleSetup.flashcardInfo") || "Für ausgewählte Topics werden automatisch Starter-Flashcards erstellt"}
                </p>

                {/* Apply / Skip */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => applyModule(index)}
                    disabled={setup.status === "applying" || setup.topics.filter(tp => tp.selected).length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {setup.status === "applying"
                      ? <><Loader2 size={14} className="animate-spin" /> {t("moduleSetup.applying") || "Wird erstellt..."}</>
                      : <><Check size={14} /> {t("moduleSetup.apply") || `${setup.topics.filter(tp => tp.selected).length} Topics übernehmen`}</>
                    }
                  </button>
                  <button
                    onClick={() => skipModule(index)}
                    className="px-4 py-2.5 rounded-lg text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    {t("moduleSetup.skip") || "Überspringen"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Generate All Button */}
      {setups.some(s => s.status === "pending") && (
        <button
          onClick={async () => {
            for (let i = 0; i < setups.length; i++) {
              if (setups[i].status === "pending") {
                await generateForModule(i);
              }
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-200 dark:border-brand-800/40 text-brand-600 dark:text-brand-400 font-medium hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors"
        >
          <Sparkles size={16} /> {t("moduleSetup.generateAll") || "Alle Module vorschlagen lassen"}
        </button>
      )}
    </div>
  );
}
