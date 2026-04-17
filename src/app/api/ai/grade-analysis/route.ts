/**
 * /api/ai/grade-analysis — AI Grade Pattern Analysis
 *
 * GET ?moduleId=<uuid> (optional): Analyze grade patterns and give improvement tips.
 *
 * Returns personalized analysis:
 * - Pattern detection (which exam types you struggle with)
 * - Correlation: study time vs. grade
 * - Concrete improvement recommendations
 * - Predicted areas of weakness
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("moduleId");

  // Fetch grades with module info
  const gradesQuery = supabase
    .from("grades")
    .select("id, grade, weight, title, exam_type, date, module_id, modules(name)")
    .order("date", { ascending: true });

  if (moduleId) gradesQuery.eq("module_id", moduleId);

  const [gradesRes, timeLogsRes, topicsRes] = await Promise.all([
    gradesQuery,
    supabase.from("time_logs").select("module_id, duration_seconds, started_at"),
    supabase.from("topics").select("title, knowledge_level, module_id").lt("knowledge_level", 50),
  ]);

  const grades = (gradesRes.data ?? []) as any[];
  const timeLogs = timeLogsRes.data ?? [];
  const weakTopics = topicsRes.data ?? [];

  if (grades.length < 2) {
    return NextResponse.json({
      analysis: null,
      message: "Mindestens 2 Noten nötig für eine Analyse",
    });
  }

  // ── Pattern Analysis ──

  // 1. Grade trend over time
  const gradeValues = grades.filter((g) => g.grade != null).map((g) => g.grade as number);
  const avgGrade = gradeValues.reduce((s, g) => s + g, 0) / gradeValues.length;
  const recentGrades = gradeValues.slice(-3);
  const recentAvg = recentGrades.reduce((s, g) => s + g, 0) / recentGrades.length;
  const trend = recentAvg > avgGrade + 0.2 ? "improving" : recentAvg < avgGrade - 0.2 ? "declining" : "stable";

  // 2. Performance by exam type
  const byExamType = new Map<string, number[]>();
  for (const g of grades) {
    if (g.grade == null || !g.exam_type) continue;
    const existing = byExamType.get(g.exam_type) ?? [];
    existing.push(g.grade);
    byExamType.set(g.exam_type, existing);
  }

  const examTypePerformance = [...byExamType.entries()].map(([type, values]) => ({
    type,
    count: values.length,
    average: Math.round(values.reduce((s, g) => s + g, 0) / values.length * 100) / 100,
    best: Math.max(...values),
    worst: Math.min(...values),
  })).sort((a, b) => a.average - b.average);

  // 3. Study time vs. grade correlation per module
  const moduleGrades = new Map<string, { totalGrade: number; count: number; moduleName: string }>();
  for (const g of grades) {
    if (g.grade == null) continue;
    const existing = moduleGrades.get(g.module_id) ?? { totalGrade: 0, count: 0, moduleName: (g.modules as any)?.name ?? "" };
    existing.totalGrade += g.grade;
    existing.count++;
    moduleGrades.set(g.module_id, existing);
  }

  const moduleStudyTime = new Map<string, number>();
  for (const log of timeLogs) {
    const current = moduleStudyTime.get(log.module_id) ?? 0;
    moduleStudyTime.set(log.module_id, current + (log.duration_seconds ?? 0));
  }

  const studyGradeCorrelation = [...moduleGrades.entries()]
    .filter(([id]) => moduleStudyTime.has(id))
    .map(([id, { totalGrade, count, moduleName }]) => ({
      module: moduleName,
      avgGrade: Math.round(totalGrade / count * 100) / 100,
      studyHours: Math.round((moduleStudyTime.get(id) ?? 0) / 3600 * 10) / 10,
    }))
    .sort((a, b) => b.avgGrade - a.avgGrade);

  // 4. Recommendations
  const recommendations: string[] = [];

  // Weakest exam type
  if (examTypePerformance.length > 0) {
    const weakest = examTypePerformance[0];
    if (weakest.average < 4.5) {
      recommendations.push(`"${weakest.type}"-Prüfungen sind deine Schwachstelle (Ø ${weakest.average}). Übe gezielt mit diesem Format.`);
    }
  }

  // Study time correlation
  const lowStudyHighGrade = studyGradeCorrelation.filter((m) => m.studyHours < 10 && m.avgGrade >= 5.0);
  const highStudyLowGrade = studyGradeCorrelation.filter((m) => m.studyHours > 20 && m.avgGrade < 4.5);

  if (highStudyLowGrade.length > 0) {
    recommendations.push(`In "${highStudyLowGrade[0].module}" investierst du viel Zeit (${highStudyLowGrade[0].studyHours}h) aber die Noten sind niedrig. Überprüfe deine Lernmethode.`);
  }
  if (lowStudyHighGrade.length > 0) {
    recommendations.push(`"${lowStudyHighGrade[0].module}" läuft gut mit wenig Aufwand — hier kannst du Zeit sparen.`);
  }

  // Trend-based
  if (trend === "declining") {
    recommendations.push("Dein Notentrend ist abwärts. Priorisiere schwache Module und plane gezielt Lernblöcke ein.");
  } else if (trend === "improving") {
    recommendations.push("Dein Notentrend ist positiv — halte den aktuellen Rhythmus bei.");
  }

  // Weak topics
  if (weakTopics.length > 5) {
    recommendations.push(`Du hast ${weakTopics.length} Themen mit Wissenslücken. Starte mit Flashcard-Reviews um die Basics zu sichern.`);
  }

  return NextResponse.json({
    analysis: {
      overview: {
        totalGrades: gradeValues.length,
        average: Math.round(avgGrade * 100) / 100,
        best: Math.max(...gradeValues),
        worst: Math.min(...gradeValues),
        trend,
        passed: gradeValues.filter((g) => g >= 4.0).length,
        failed: gradeValues.filter((g) => g < 4.0).length,
      },
      examTypePerformance,
      studyGradeCorrelation,
      weakTopicCount: weakTopics.length,
      recommendations,
    },
  });
}
