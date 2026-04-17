"use client";

import { memo, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { GraduationCap, Clock, Brain, ChevronDown } from "lucide-react";
import type { CalendarEvent, Topic } from "@/types/database";

type Exam = CalendarEvent & { daysLeft?: number };

interface Props {
  exams: Exam[];
  topics: Topic[];
}

function DashboardExamList({ exams, topics }: Props) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [examAttachments, setExamAttachments] = useState<Record<string, any[]>>({});

  const fetchExamDetails = useCallback(async (examId: string) => {
    const { data } = await supabase
      .from("exam_attachments")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: false });
    setExamAttachments(prev => ({ ...prev, [examId]: data ?? [] }));
  }, [supabase]);

  const toggleExamExpand = (examId: string) => {
    if (expandedExam === examId) {
      setExpandedExam(null);
    } else {
      setExpandedExam(examId);
      if (!examAttachments[examId]) fetchExamDetails(examId);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          <GraduationCap size={16} className="text-brand-500" /> {t("dashboard.upcomingExams")}
        </h2>
        <Link href="/exams" className="text-xs text-brand-600 hover:underline">{t("dashboard.showAll")}</Link>
      </div>
      {exams.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.allDone")}</p>
      ) : (
        <div className="space-y-2">
          {exams.slice(0, 5).map(exam => {
            const d = exam.daysLeft ?? 999;
            const isToday = d === 0;
            const isUrgent = d > 0 && d <= 3;
            const isSoon = d > 3 && d <= 7;
            const isExpanded = expandedExam === exam.id;
            const attachments = examAttachments[exam.id] ?? [];
            const examTopics = topics.filter(tp => tp.exam_id === exam.id);

            return (
              <div key={exam.id}>
                <button
                  onClick={() => toggleExamExpand(exam.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isToday ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" :
                    isUrgent ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800" :
                    isSoon ? "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900" :
                    "bg-surface-50 hover:bg-surface-100 dark:hover:bg-surface-800"
                  } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                    style={{ background: exam.color ?? "#6d28d9" }}>
                    <GraduationCap size={16} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{exam.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{formatDate(exam.start_dt)}{exam.location ? ` · ${exam.location}` : ""}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                    isToday ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
                    isUrgent ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" :
                    isSoon ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
                    d <= 30 ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  }`}>
                    <Clock size={12} />
                    {isToday ? t("dashboard.today") : d === 1 ? t("dashboard.tomorrow") : `${d} ${t("dashboard.daysLeft")}`}
                  </div>
                </button>
                {isExpanded && (
                  <div className="bg-surface-50 border border-surface-200 border-t-0 rounded-b-xl p-3 text-sm space-y-2">
                    {exam.description && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.description")}</p>
                        <p className="text-xs text-surface-700">{exam.description}</p>
                      </div>
                    )}
                    {examTopics.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.relatedTopics")}</p>
                        <div className="space-y-1">
                          {examTopics.slice(0, 3).map(topic => (
                            <div key={topic.id} className="flex items-center justify-between text-xs">
                              <span className="text-surface-700 truncate">{topic.title}</span>
                              <span className="text-surface-400 text-[10px] ml-2 shrink-0">
                                {topic.knowledge_level >= 3 ? "✓" : topic.knowledge_level === 2 ? "◐" : "○"}
                              </span>
                            </div>
                          ))}
                          {examTopics.length > 3 && (
                            <p className="text-[10px] text-surface-400">+{examTopics.length - 3} {t("dashboard.more")}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.attachments")}</p>
                        <div className="space-y-1">
                          {attachments.slice(0, 3).map((att: any) => (
                            <div key={att.id} className="text-xs text-surface-600 truncate">
                              {att.kind === "link" ? "🔗" : att.kind === "note" ? "📝" : "📎"} {att.label || att.url}
                            </div>
                          ))}
                          {attachments.length > 3 && <p className="text-[10px] text-surface-400">+{attachments.length - 3}</p>}
                        </div>
                      </div>
                    )}
                    {attachments.length === 0 && examTopics.length === 0 && !exam.description && (
                      <p className="text-xs text-surface-400">{t("dashboard.noDetails")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(DashboardExamList);
