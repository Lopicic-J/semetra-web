"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Target, Check, X, Save, Loader2, GraduationCap, FileText } from "lucide-react";

interface Topic {
  id: string;
  title: string;
  is_exam_relevant: boolean;
  exam_relevance_note: string | null;
  knowledge_level: number | null;
}

interface Props {
  moduleId: string;
  moduleName: string;
}

/**
 * Panel to manage exam relevance for topics in a module.
 * Students toggle which topics are exam-relevant and add dozent notes.
 */
function ExamRelevancePanel({ moduleId, moduleName }: Props) {
  const { t } = useTranslation();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [examNotes, setExamNotes] = useState("");
  const [examFormat, setExamFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-relevance?moduleId=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics ?? []);
        setExamNotes(data.examNotes ?? "");
        setExamFormat(data.examFormat ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const toggleTopic = async (topicId: string, current: boolean) => {
    // Optimistic update
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, is_exam_relevant: !current } : t));

    await fetch("/api/exam-relevance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, isExamRelevant: !current }),
    });
  };

  const saveNotes = async () => {
    setSaving(true);
    await fetch("/api/exam-relevance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, examNotes }),
    });
    setSaving(false);
  };

  const relevantCount = topics.filter(t => t.is_exam_relevant).length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800/40 transition-colors"
      >
        <Target size={13} />
        {t("examRelevance.manage") || "Prüfungsrelevanz verwalten"}
        {relevantCount > 0 && ` (${relevantCount})`}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-[rgb(var(--card-bg))] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-100 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10">
        <span className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
          <Target size={14} />
          {t("examRelevance.title") || "Prüfungsrelevanz"} — {moduleName}
        </span>
        <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-600">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Exam Notes */}
        <div>
          <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5 flex items-center gap-1">
            <FileText size={11} /> {t("examRelevance.dozentNotes") || "Dozent-Hinweise"}
          </label>
          <textarea
            value={examNotes}
            onChange={e => setExamNotes(e.target.value)}
            placeholder={t("examRelevance.notesPlaceholder") || "z.B. Kapitel 3-7 prüfungsrelevant, MC + offene Fragen, Taschenrechner erlaubt..."}
            className="w-full p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-xs min-h-[60px] resize-none"
            onBlur={saveNotes}
          />
          {examFormat && (
            <p className="text-[10px] text-surface-400 mt-1">Prüfungsformat: {examFormat}</p>
          )}
        </div>

        {/* Topic Toggles */}
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-surface-400">
            <Loader2 size={14} className="animate-spin" /> Wird geladen...
          </div>
        ) : topics.length === 0 ? (
          <p className="text-xs text-surface-400 text-center py-4">
            Keine Topics vorhanden. Erstelle zuerst Topics für dieses Modul.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-surface-600 dark:text-surface-400">
                {t("examRelevance.topics") || "Topics"} ({relevantCount}/{topics.length} relevant)
              </p>
            </div>
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id, topic.is_exam_relevant)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  topic.is_exam_relevant
                    ? "bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-800/30"
                    : "hover:bg-surface-50 dark:hover:bg-surface-800/50 border border-transparent"
                }`}
              >
                {topic.is_exam_relevant
                  ? <Check size={14} className="text-red-500 shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded border border-surface-300 dark:border-surface-600 shrink-0" />
                }
                <span className={`text-sm flex-1 ${topic.is_exam_relevant ? "text-surface-900 dark:text-surface-100 font-medium" : "text-surface-600 dark:text-surface-400"}`}>
                  {topic.title}
                </span>
                {topic.knowledge_level !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    topic.knowledge_level >= 70 ? "bg-emerald-100 text-emerald-600" :
                    topic.knowledge_level >= 40 ? "bg-amber-100 text-amber-600" :
                    "bg-red-100 text-red-600"
                  }`}>
                    {topic.knowledge_level}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ExamRelevancePanel);
