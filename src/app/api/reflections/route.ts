/**
 * /api/reflections — Session Reflections
 *
 * GET: List reflections (optionally filtered by module)
 * POST: Save a new reflection after a learning session
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("moduleId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("session_reflections")
    .select("*, modules(name, color), topics(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (moduleId) query = query.eq("module_id", moduleId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reflections: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    sessionId, moduleId, topicId,
    learned, difficult, nextSteps,
    understandingRating, confidenceRating, energyAfter,
    sessionDurationSeconds, sessionType,
  } = body;

  const { data, error } = await supabase
    .from("session_reflections")
    .insert({
      user_id: user.id,
      session_id: sessionId ?? null,
      module_id: moduleId ?? null,
      topic_id: topicId ?? null,
      learned: learned ?? null,
      difficult: difficult ?? null,
      next_steps: nextSteps ?? null,
      understanding_rating: understandingRating ?? null,
      confidence_rating: confidenceRating ?? null,
      energy_after: energyAfter ?? null,
      session_duration_seconds: sessionDurationSeconds ?? null,
      session_type: sessionType ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update topic knowledge level based on understanding rating
  if (topicId && understandingRating) {
    const newLevel = Math.min(100, understandingRating * 20); // 1→20, 5→100
    await supabase
      .from("topics")
      .update({ knowledge_level: newLevel })
      .eq("id", topicId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ reflection: data, saved: true });
}
