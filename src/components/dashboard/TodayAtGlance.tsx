"use client";

import { useState, useEffect } from "react";
import { Zap, CalendarClock, GraduationCap, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface BlockInfo {
  title: string;
  startTime: string;
  moduleColor: string;
}

interface GlanceData {
  flashcardsDue: number;
  nextBlock: BlockInfo | null;
  nextExam: { title: string; daysLeft: number } | null;
  scheduledBlocks: number;
  upcomingBlocks: BlockInfo[];
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
          .select("title, start_dt")
          .eq("user_id", user.id)
          .eq("event_type", "exam")
          .gte("start_dt", today)
          .order("start_dt")
          .limit(1),
      ]);

      // Error-safe data extraction
      const blocks = blockRes.data || [];
      const upcomingBlocks = blocks.slice(0, 3).map(b => ({
        title: b.title,
        startTime: b.start_time,
        moduleColor: (b.module as any)?.color || b.color || "#6d28d9",
      }));

      const exam = (examRes.data || [])[0];
      const nextExam = exam ? {
        title: exam.title,
        daysLeft: Math.max(0, Math.ceil((new Date(exam.start_dt).getTime() - now.getTime()) / 86400000)),
      } : null;

      setData({
        flashcardsDue: fcRes.count ?? 0,
        nextBlock: upcomingBlocks[0] ?? null,
        nextExam,
        scheduledBlocks: blocks.length,
        upcomingBlocks,
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

      {/* Mini-Timeline: next 3 blocks */}
      {data.upcomingBlocks.length > 0 && (
        <Link
          href="/smart-schedule"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-950/30 transition-colors no-underline"
        >
          <CalendarClock size={14} className="text-brand-500 shrink-0" />
          <div className="flex items-center gap-1.5 overflow-hidden">
            {data.upcomingBlocks.map((b, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-brand-300 dark:text-brand-600">→</span>}
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: b.moduleColor }} />
                <span className="tabular-nums text-brand-500 dark:text-brand-400">
                  {new Date(b.startTime).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            ))}
            {data.scheduledBlocks > 3 && (
              <span className="text-brand-400 dark:text-brand-500 shrink-0">+{data.scheduledBlocks - 3}</span>
            )}
          </div>
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
