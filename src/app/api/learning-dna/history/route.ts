/**
 * /api/learning-dna/history — DNA Snapshot History & Trends
 *
 * GET: Returns all snapshots for trend visualization.
 *      Query params: ?limit=20 (default 20, max 52)
 *
 * Used by the DNA dashboard to show score progression over time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SnapshotRow {
  id: string;
  consistency_score: number;
  focus_score: number;
  endurance_score: number;
  adaptability_score: number;
  planning_score: number;
  overall_score: number;
  learner_type: string;
  sessions_analyzed: number;
  total_study_minutes: number;
  created_at: string;
}

interface TrendPoint {
  date: string;
  consistency: number;
  focus: number;
  endurance: number;
  adaptability: number;
  planning: number;
  overall: number;
  learnerType: string;
}

interface TrendSummary {
  dimension: string;
  current: number;
  previous: number;
  change: number;
  trend: "improving" | "stable" | "declining";
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(52, Math.max(1, parseInt(limitParam ?? "20", 10) || 20));

  const { data: snapshotsRaw } = await supabase
    .from("learning_dna_snapshots")
    .select(
      "id, consistency_score, focus_score, endurance_score, adaptability_score, planning_score, overall_score, learner_type, sessions_analyzed, total_study_minutes, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(limit);

  const snapshots = (snapshotsRaw ?? []) as SnapshotRow[];

  if (snapshots.length === 0) {
    return NextResponse.json({ history: [], trends: [], message: "Keine Snapshots vorhanden" });
  }

  // Build trend points (chronological)
  const history: TrendPoint[] = snapshots.map((s) => ({
    date: s.created_at,
    consistency: s.consistency_score,
    focus: s.focus_score,
    endurance: s.endurance_score,
    adaptability: s.adaptability_score,
    planning: s.planning_score,
    overall: s.overall_score,
    learnerType: s.learner_type,
  }));

  // Compute trend summaries (current vs previous)
  const trends: TrendSummary[] = [];
  if (snapshots.length >= 2) {
    const current = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    const dimensions: { key: string; label: string }[] = [
      { key: "consistency_score", label: "Konsistenz" },
      { key: "focus_score", label: "Fokus" },
      { key: "endurance_score", label: "Ausdauer" },
      { key: "adaptability_score", label: "Anpassung" },
      { key: "planning_score", label: "Planung" },
      { key: "overall_score", label: "Gesamt" },
    ];

    for (const dim of dimensions) {
      const curr = current[dim.key as keyof SnapshotRow] as number;
      const prev = previous[dim.key as keyof SnapshotRow] as number;
      const change = curr - prev;

      trends.push({
        dimension: dim.label,
        current: curr,
        previous: prev,
        change: Math.round(change * 10) / 10,
        trend: Math.abs(change) < 2 ? "stable" : change > 0 ? "improving" : "declining",
      });
    }
  }

  // Aggregate stats
  const totalSessions = snapshots.reduce((sum, s) => sum + (s.sessions_analyzed || 0), 0);
  const totalMinutes = snapshots.reduce((sum, s) => sum + (s.total_study_minutes || 0), 0);
  const latestType = snapshots[snapshots.length - 1].learner_type;

  // Learner type changes
  const typeChanges: { from: string; to: string; date: string }[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].learner_type !== snapshots[i - 1].learner_type) {
      typeChanges.push({
        from: snapshots[i - 1].learner_type,
        to: snapshots[i].learner_type,
        date: snapshots[i].created_at,
      });
    }
  }

  return NextResponse.json({
    history,
    trends,
    stats: {
      snapshotCount: snapshots.length,
      totalSessions,
      totalStudyMinutes: totalMinutes,
      currentType: latestType,
      typeChanges,
    },
  });
}
