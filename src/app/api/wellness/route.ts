/**
 * /api/wellness — Student Wellness & Balance Tracking
 *
 * GET: Get recent wellness data + balance analysis
 * POST: Log daily mood/energy/stress self-report
 *
 * Tracks: mood (1-5), energy (1-5), stress (1-5), sleep_quality (1-5)
 * Generates: balance warnings, burnout risk, recovery suggestions
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "14"), 30);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get wellness logs
  const { data: reflections } = await supabase
    .from("session_reflections")
    .select("energy_after, understanding_rating, confidence_rating, session_duration_seconds, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const entries = reflections ?? [];

  if (entries.length === 0) {
    return NextResponse.json({
      data: [],
      analysis: null,
      message: "Noch keine Wellness-Daten. Schliesse Lernsessions mit Reflexion ab.",
    });
  }

  // Average metrics
  const avgEnergy = entries.reduce((s, e) => s + (e.energy_after ?? 3), 0) / entries.length;
  const avgUnderstanding = entries.reduce((s, e) => s + (e.understanding_rating ?? 3), 0) / entries.length;
  const avgConfidence = entries.reduce((s, e) => s + (e.confidence_rating ?? 3), 0) / entries.length;
  const totalStudyMinutes = entries.reduce((s, e) => s + (e.session_duration_seconds ?? 0), 0) / 60;
  const avgSessionMinutes = totalStudyMinutes / entries.length;

  // Trend: compare first half vs second half
  const midpoint = Math.floor(entries.length / 2);
  const recentEnergy = entries.slice(0, midpoint).reduce((s, e) => s + (e.energy_after ?? 3), 0) / Math.max(1, midpoint);
  const olderEnergy = entries.slice(midpoint).reduce((s, e) => s + (e.energy_after ?? 3), 0) / Math.max(1, entries.length - midpoint);
  const energyTrend = recentEnergy > olderEnergy + 0.3 ? "improving" : recentEnergy < olderEnergy - 0.3 ? "declining" : "stable";

  // Warnings
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Burnout indicators
  if (avgEnergy < 2.5) {
    warnings.push("Deine Energie ist durchschnittlich niedrig. Mögliches Burnout-Risiko.");
    suggestions.push("Plane bewusste Pausen ein. Kürzere, fokussierte Sessions statt Marathon-Lernen.");
  }

  if (avgSessionMinutes > 90) {
    warnings.push("Deine durchschnittliche Session ist über 90 Minuten. Das ist für fokussiertes Lernen zu lang.");
    suggestions.push("Teile Sessions in 45-Min-Blöcke mit 10-Min-Pausen auf.");
  }

  if (energyTrend === "declining") {
    warnings.push("Dein Energielevel sinkt über die letzten Tage.");
    suggestions.push("Priorisiere Schlaf und Bewegung. Reduziere die Lernzeit vorübergehend.");
  }

  // Long study days check
  const studyByDate = new Map<string, number>();
  for (const e of entries) {
    const date = e.created_at.split("T")[0];
    studyByDate.set(date, (studyByDate.get(date) ?? 0) + (e.session_duration_seconds ?? 0));
  }
  const longDays = [...studyByDate.values()].filter(s => s > 6 * 3600).length;
  if (longDays > 2) {
    warnings.push(`${longDays} Tage mit über 6h Lernzeit in den letzten ${days} Tagen.`);
    suggestions.push("Verteile die Lernzeit gleichmässiger. Qualität > Quantität.");
  }

  // Positive feedback
  if (avgEnergy >= 4 && avgConfidence >= 4) {
    suggestions.push("Du fühlst dich gut und bist zuversichtlich — weiter so!");
  }

  // Balance score (0-100)
  const balanceScore = Math.round(
    (Math.min(avgEnergy / 5, 1) * 0.3 +
     Math.min(avgConfidence / 5, 1) * 0.3 +
     Math.min(avgUnderstanding / 5, 1) * 0.2 +
     (avgSessionMinutes >= 30 && avgSessionMinutes <= 90 ? 1 : avgSessionMinutes < 30 ? 0.5 : 0.3) * 0.2
    ) * 100
  );

  return NextResponse.json({
    data: entries.slice(0, 20),
    analysis: {
      balanceScore,
      averages: {
        energy: Math.round(avgEnergy * 10) / 10,
        understanding: Math.round(avgUnderstanding * 10) / 10,
        confidence: Math.round(avgConfidence * 10) / 10,
        sessionMinutes: Math.round(avgSessionMinutes),
      },
      trends: { energy: energyTrend },
      totalSessions: entries.length,
      totalStudyHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
      warnings,
      suggestions,
    },
    period: `${days} Tage`,
  });
}
