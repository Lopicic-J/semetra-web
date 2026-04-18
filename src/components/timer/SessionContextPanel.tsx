"use client";

import { memo } from "react";
import Link from "next/link";
import { Brain, Zap, Target, GraduationCap, BookOpen, ExternalLink } from "lucide-react";

interface Props {
  learningGoal: string;
  moduleId: string;
  moduleName: string;
  moduleColor?: string;
  topicTitle?: string;
  topicKnowledgeLevel?: number;
  examTitle?: string;
  examDaysLeft?: number;
  taskTitle?: string;
  weakTopicCount?: number;
  flashcardsDue?: number;
}

/**
 * Contextual study panel shown during active timer sessions.
 * Shows relevant content and quick links based on the learning goal.
 */
function SessionContextPanel({
  learningGoal, moduleId, moduleName, moduleColor,
  topicTitle, topicKnowledgeLevel, examTitle, examDaysLeft,
  taskTitle, weakTopicCount, flashcardsDue,
}: Props) {
  if (!learningGoal || learningGoal === "free") return null;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-3 mb-4">
      {/* Module context */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: moduleColor ?? "#6d28d9" }} />
        <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{moduleName}</span>
      </div>

      {/* Goal-specific content */}
      {learningGoal === "weak_topic" && (
        <div className="space-y-2">
          {topicTitle && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Target size={12} className="text-red-500" />
                <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{topicTitle}</span>
              </div>
              {topicKnowledgeLevel !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  topicKnowledgeLevel >= 70 ? "bg-emerald-100 text-emerald-600" :
                  topicKnowledgeLevel >= 40 ? "bg-amber-100 text-amber-600" :
                  "bg-red-100 text-red-600"
                }`}>{topicKnowledgeLevel}%</span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Link href={`/flashcards?module=${moduleId}`}
              className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 no-underline">
              <Zap size={10} /> Flashcards
            </Link>
            <Link href={`/modules/${moduleId}/learn`}
              className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 no-underline">
              <BookOpen size={10} /> Lernraum
            </Link>
          </div>
        </div>
      )}

      {learningGoal === "exam_prep" && (
        <div className="space-y-2">
          {examTitle && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <GraduationCap size={12} className="text-violet-500" />
                <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{examTitle}</span>
              </div>
              {examDaysLeft !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  examDaysLeft <= 3 ? "bg-red-100 text-red-600" :
                  examDaysLeft <= 7 ? "bg-amber-100 text-amber-600" :
                  "bg-blue-100 text-blue-600"
                }`}>{examDaysLeft === 0 ? "Heute" : `${examDaysLeft}d`}</span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Link href={`/exam-simulator?module=${moduleId}`}
              className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 no-underline">
              <Target size={10} /> Simulator
            </Link>
            <Link href={`/exam-prep`}
              className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 no-underline">
              <ExternalLink size={10} /> Prep-Plan
            </Link>
          </div>
          {weakTopicCount !== undefined && weakTopicCount > 0 && (
            <p className="text-[10px] text-surface-400">{weakTopicCount} schwache Topics · {flashcardsDue ?? 0} Karten fällig</p>
          )}
        </div>
      )}

      {learningGoal === "task" && taskTitle && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-surface-800 dark:text-surface-200">{taskTitle}</span>
        </div>
      )}
    </div>
  );
}

export default memo(SessionContextPanel);
