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
