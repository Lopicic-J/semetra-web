/**
 * /api/guided-session — Guided Learning Session Management
 *
 * GET: List available templates (system defaults + user custom)
 * GET ?recommended=true: Get DNA-recommended template
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const recommended = url.searchParams.get("recommended") === "true";

  // Get all templates (system + user's custom)
  const { data: templates } = await supabase
    .from("guided_session_templates")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order("is_default", { ascending: false })
    .order("total_minutes");

  if (recommended) {
    // Get user's DNA profile to recommend best template
    const { data: dnaSnapshot } = await supabase
      .from("learning_dna_snapshots")
      .select("learner_type, focus_score, endurance_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let recommendedTemplate = templates?.find(t => t.is_default); // Fallback to default

    if (dnaSnapshot) {
      const focusScore = dnaSnapshot.focus_score ?? 50;
      const enduranceScore = dnaSnapshot.endurance_score ?? 50;

      // Low focus → shorter sessions (Quick Focus 25min)
      if (focusScore < 40) {
        recommendedTemplate = templates?.find(t => t.total_minutes <= 25) ?? recommendedTemplate;
      }
      // High endurance → longer sessions (Intensiv 90min)
      else if (enduranceScore >= 70) {
        recommendedTemplate = templates?.find(t => t.total_minutes >= 90) ?? recommendedTemplate;
      }
      // Near exam → exam prep template
      // Check if any exam is within 7 days
      const { data: nearExams } = await supabase
        .from("events")
        .select("id")
        .eq("event_type", "exam")
        .gte("start_dt", new Date().toISOString())
        .lte("start_dt", new Date(Date.now() + 7 * 86400000).toISOString())
        .limit(1);

      if (nearExams && nearExams.length > 0) {
        recommendedTemplate = templates?.find(t => t.name.includes("Prüfung")) ?? recommendedTemplate;
      }
    }

    return NextResponse.json({
      recommended: recommendedTemplate,
      all: templates ?? [],
      dnaLearnerType: dnaSnapshot?.learner_type ?? null,
    });
  }

  return NextResponse.json({ templates: templates ?? [] });
}
