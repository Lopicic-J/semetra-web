/**
 * /api/streaks/intelligence — Advanced Streak Analytics
 *
 * GET: Returns full streak intelligence including milestones,
 *      health scoring, break risk, and celebration triggers.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeStreaks } from "@/lib/streaks/intelligence";

interface SessionRow {
  started_at: string;
  duration_seconds: number;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all completed sessions (last 365 days for full streak history)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: sessionsRaw } = await supabase
    .from("time_logs")
    .select("started_at, duration_seconds")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("started_at", oneYearAgo.toISOString())
    .order("started_at", { ascending: true });

  const sessions = (sessionsRaw ?? []) as SessionRow[];

  if (sessions.length === 0) {
    return NextResponse.json({
      intelligence: {
        currentStreak: 0,
        longestStreak: 0,
        totalStreaks: 0,
        health: {
          score: 0,
          trend: "stable",
          avgMinutesPerDay: 0,
          consistencyRatio: 0,
          longestGapHours: 0,
          riskOfBreak: "high",
          riskReason: "Noch keine Lernsessions vorhanden",
        },
        milestones: [],
        nextMilestone: { days: 3, label: "3-Tage-Start", emoji: "🌱", reached: false },
        recentActivity: [],
        celebrationTrigger: null,
      },
      message: "Starte deine erste Lernsession, um Streaks zu sammeln!",
    });
  }

  const intelligence = analyzeStreaks(sessions, 90);

  return NextResponse.json({ intelligence });
}
