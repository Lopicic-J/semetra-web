/**
 * /api/learning-dna — Lern-DNA Profile & Snapshots
 *
 * GET:  Return current DNA profile (latest snapshot or compute fresh)
 * POST: Force recompute and store new snapshot
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDnaProfile, getLearnerTypeInfo } from "@/lib/learning-dna/analyzer";

interface SnapshotRow {
  id: string;
  consistency_score: number;
  focus_score: number;
  endurance_score: number;
  adaptability_score: number;
  planning_score: number;
  overall_score: number;
  learner_type: string;
  created_at: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try latest snapshot first
  const { data: snapshotRaw } = await supabase
    .from("learning_dna_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const snapshot = snapshotRaw as SnapshotRow | null;

  if (snapshot) {
    // Check if stale (> 24h old)
    const age = Date.now() - new Date(snapshot.created_at).getTime();
    const isStale = age > 24 * 3600_000;

    const typeInfo = getLearnerTypeInfo(snapshot.learner_type);

    return NextResponse.json({
      profile: {
        consistencyScore: snapshot.consistency_score,
        focusScore: snapshot.focus_score,
        enduranceScore: snapshot.endurance_score,
        adaptabilityScore: snapshot.adaptability_score,
        planningScore: snapshot.planning_score,
        overallScore: snapshot.overall_score,
        learnerType: snapshot.learner_type,
        learnerTypeLabel: typeInfo.de,
        learnerTypeDescription: typeInfo.description,
      },
      isStale,
      snapshotAge: Math.round(age / 3600_000),
      createdAt: snapshot.created_at,
    });
  }

  // No snapshot exists — compute fresh
  const profile = await computeAndStore(supabase, user.id);
  if (!profile) {
    return NextResponse.json({
      profile: null,
      message: "Zu wenig Daten für ein DNA-Profil. Starte ein paar Lernsessions!",
    });
  }

  const typeInfo = getLearnerTypeInfo(profile.learnerType);
  return NextResponse.json({
    profile: {
      ...profile,
      learnerTypeLabel: typeInfo.de,
      learnerTypeDescription: typeInfo.description,
    },
    isStale: false,
    snapshotAge: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await computeAndStore(supabase, user.id);
  if (!profile) {
    return NextResponse.json({
      profile: null,
      message: "Zu wenig Daten für ein DNA-Profil",
    });
  }

  const typeInfo = getLearnerTypeInfo(profile.learnerType);
  return NextResponse.json({
    profile: {
      ...profile,
      learnerTypeLabel: typeInfo.de,
      learnerTypeDescription: typeInfo.description,
    },
    refreshed: true,
  });
}

/**
 * PATCH: Micro-update DNA scores after a timer session completes.
 * Uses Exponential Moving Average (alpha=0.1) to gradually adjust
 * only the dimensions affected by the session data.
 *
 * Body: { focusRating?: 1-5, energyLevel?: 1-5, durationMinutes?: number, alignment?: string }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { focusRating, energyLevel, durationMinutes, alignment } = body as {
    focusRating?: number;
    energyLevel?: number;
    durationMinutes?: number;
    alignment?: string;
  };

  // Load latest snapshot
  const { data: snapshotRaw } = await supabase
    .from("learning_dna_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!snapshotRaw) {
    return NextResponse.json({ updated: false, reason: "no_snapshot" });
  }

  const snapshot = snapshotRaw as SnapshotRow;
  const ALPHA = 0.1; // EMA smoothing factor — slow adaptation

  // Helper: EMA update, maps input (1-5 or raw) to 0-100 score
  const ema = (oldScore: number, newValue: number) =>
    Math.round(ALPHA * newValue + (1 - ALPHA) * oldScore);

  let focusScore = snapshot.focus_score;
  let enduranceScore = snapshot.endurance_score;
  let planningScore = snapshot.planning_score;
  let consistencyScore = snapshot.consistency_score;

  // Focus: from focus_rating (1-5 → 0-100)
  if (focusRating && focusRating >= 1 && focusRating <= 5) {
    const normalized = (focusRating - 1) * 25; // 1→0, 2→25, 3→50, 4→75, 5→100
    focusScore = ema(snapshot.focus_score, normalized);
  }

  // Endurance: from session duration (longer = higher endurance signal)
  if (durationMinutes && durationMinutes > 0) {
    // 15min→20, 30min→40, 45min→60, 60min→75, 90min→90, 120+→100
    const normalized = Math.min(100, Math.round(durationMinutes * 100 / 120));
    enduranceScore = ema(snapshot.endurance_score, normalized);
  }

  // Planning: from alignment (within_plan=100, partial_overlap=60, unplanned=20)
  if (alignment) {
    const alignmentScores: Record<string, number> = {
      within_plan: 100,
      partial_overlap: 60,
      rescheduled: 40,
      unplanned: 20,
    };
    const normalized = alignmentScores[alignment] ?? 50;
    planningScore = ema(snapshot.planning_score, normalized);
  }

  // Consistency: bump slightly for completing a session (studied today = good)
  consistencyScore = ema(snapshot.consistency_score, Math.min(100, snapshot.consistency_score + 5));

  // Overall: weighted average of all 5 dimensions
  const adaptabilityScore = snapshot.adaptability_score; // Not affected by single session
  const overallScore = Math.round(
    (consistencyScore * 0.2 + focusScore * 0.25 + enduranceScore * 0.2 +
     adaptabilityScore * 0.15 + planningScore * 0.2)
  );

  // Determine learner type from updated scores
  const { getLearnerTypeInfo, classifyLearner } = await import("@/lib/learning-dna/analyzer");
  const learnerType = classifyLearner({
    consistencyScore, focusScore, enduranceScore, adaptabilityScore, planningScore, overallScore,
    learnerType: "",
  });

  // Update latest snapshot in-place (no new row — micro-updates are incremental)
  await supabase
    .from("learning_dna_snapshots")
    .update({
      consistency_score: consistencyScore,
      focus_score: focusScore,
      endurance_score: enduranceScore,
      planning_score: planningScore,
      overall_score: overallScore,
      learner_type: learnerType,
    })
    .eq("id", snapshot.id);

  const typeInfo = getLearnerTypeInfo(learnerType);

  return NextResponse.json({
    updated: true,
    profile: {
      consistencyScore, focusScore, enduranceScore,
      adaptabilityScore, planningScore, overallScore,
      learnerType,
      learnerTypeLabel: typeInfo.de,
      learnerTypeDescription: typeInfo.description,
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeAndStore(supabase: any, userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  // Fetch data in parallel
  const [sessionsRes, blocksRes, tasksRes, reschedulesRes] = await Promise.all([
    supabase
      .from("time_logs")
      .select("duration_seconds, focus_rating, energy_level, session_type, alignment, status, started_at")
      .eq("user_id", userId)
      .gte("started_at", since),
    supabase
      .from("schedule_blocks")
      .select("planned_minutes, actual_minutes, date, was_rescheduled")
      .eq("user_id", userId)
      .gte("date", since.slice(0, 10)),
    supabase
      .from("tasks")
      .select("status, due_date, completed_at")
      .eq("user_id", userId),
    supabase
      .from("reschedule_log")
      .select("trigger, resolution, created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  const sessions = sessionsRes.data ?? [];
  const blocks = blocksRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const reschedules = reschedulesRes.data ?? [];

  if (sessions.length < 3) return null;

  const profile = computeDnaProfile(sessions, blocks, tasks, reschedules);

  // Store snapshot
  await supabase.from("learning_dna_snapshots").insert({
    user_id: userId,
    consistency_score: profile.consistencyScore,
    focus_score: profile.focusScore,
    endurance_score: profile.enduranceScore,
    adaptability_score: profile.adaptabilityScore,
    planning_score: profile.planningScore,
    overall_score: profile.overallScore,
    learner_type: profile.learnerType,
  });

  // Also update study_patterns if table exists
  await supabase
    .from("study_patterns")
    .upsert(
      {
        user_id: userId,
        consistency_score: profile.consistencyScore / 100,
        last_analyzed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .maybeSingle();

  return profile;
}
