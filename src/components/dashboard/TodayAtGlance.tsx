"use client";

import { useState, useEffect } from "react";
import { Zap, CalendarClock, GraduationCap, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface GlanceData {
  flashcardsDue: number;
  nextBlock: { title: string; startTime: string; moduleColor: string } | null;
  nextExam: { title: string; daysLeft: number } | null;
  scheduledBlocks: number;
}

/**
 * Compact "Today at a Glance" widget for the dashboard.
 * Shows flashcard due count, next schedule block, and exam countdown.
 */
export default function TodayAtGlance() {
  const [data, setData] = useState<GlanceData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      const [fcRes, blockRes, examRes] = await Promise.all([
        // Due flashcards
        supabase.from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .or(`next_review.is.null,next_review.lte.${now.toISOString()}`),
        // Today's upcoming blocks
        supabase.from("schedule_blocks")
          .select("title, start_time, color, module:modules(color)")
          .eq("user_id", user.id)
          .gte("start_time", now.toISOString())
          .lte("start_time", `${today}T23:59:59`)
          .neq("status", "skipped")
          .order("start_time")
          .limit(5),
        // Next exam
        supabase.from("events")
          .select("title, date")
          .eq("user_id", user.id)
          .eq("type", "exam")
          .gte("date", today)
          .order("date")
          .limit(1),
      ]);

      const blocks = blockRes.data || [];
      const nextBlock = blocks[0] ? {
        title: blocks[0].title,
        startTime: blocks[0].start_time,
        moduleColor: (blocks[0].module as any)?.color || blocks[0].color || "#6d28d9",
      } : null;

      const exam = (examRes.data || [])[0];
      const nextExam = exam ? {
        title: exam.title,
        daysLeft: Math.max(0, Math.ceil((new Date(exam.date).getTime() - now.getTime()) / 86400000)),
      } : null;

      setData({
        flashcardsDue: fcRes.count ?? 0,
        nextBlock,
        nextExam,
        scheduledBlocks: blocks.length,
      });
    }
    load();
  }, []);

  if (!data) return null;
  // Don't show if nothing interesting
  if (data.flashcardsDue === 0 && !data.nextBlock && !data.nextExam) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Flashcards Due */}
      {data.flashcardsDue > 0 && (
        <Link
          href="/flashcards"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors no-underline"
        >
          <Zap size={14} className="text-amber-500" />
          <span>{data.flashcardsDue} Karten fällig</span>
          <ArrowRight size={10} className="opacity-50" />
        </Link>
      )}

      {/* Next Block */}
      {data.nextBlock && (
        <Link
          href="/smart-schedule"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-950/30 transition-colors no-underline"
        >
          <CalendarClock size={14} className="text-brand-500" />
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: data.nextBlock.moduleColor }}
          />
          <span className="truncate max-w-[140px]">{data.nextBlock.title}</span>
          <span className="text-brand-500 dark:text-brand-400">
            {new Date(data.nextBlock.startTime).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Link>
      )}

      {/* Scheduled blocks count */}
      {data.scheduledBlocks > 1 && (
        <Link
          href="/smart-schedule"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 text-xs font-medium hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors no-underline"
        >
          <Clock size={12} />
          +{data.scheduledBlocks - 1} weitere Blöcke
        </Link>
      )}

      {/* Exam Countdown */}
      {data.nextExam && (
        <Link
          href="/exams"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors no-underline ${
            data.nextExam.daysLeft <= 3
              ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/30"
              : data.nextExam.daysLeft <= 7
              ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/30"
              : "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/30"
          }`}
        >
          <GraduationCap size={14} />
          <span className="truncate max-w-[120px]">{data.nextExam.title}</span>
          <span className="font-bold">
            {data.nextExam.daysLeft === 0 ? "Heute!" : `${data.nextExam.daysLeft}d`}
          </span>
        </Link>
      )}
    </div>
  );
}
