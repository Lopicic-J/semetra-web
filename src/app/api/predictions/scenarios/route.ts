/**
 * /api/predictions/scenarios — Grade Prediction & Scenario Simulator
 *
 * GET:  Predict final grade for a module based on current data
 *       Query: ?moduleId=<uuid>
 *
 * POST: Run custom scenario ("what-if" analysis)
 *       Body: { moduleId, scenarios: [{ examGrade, taskBonus }] }
 *
 * Uses weighted component grades, exam predictions, and DNA-influenced
 * confidence scoring to produce realistic grade forecasts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────────

interface GradeRow {
  id: string;
  grade: number;
  weight: number | null;
  date: string;
  component_type: string | null;
}

interface ExamRow {
  id: string;
  title: string;
  date: string;
  weight: number | null;
  grade: number | null;
}

interface ModuleRow {
  id: string;
  name: string;
  ects: number;
  target_grade: number | null;
  grading_system: string | null;
}

interface DnaRow {
  consistency_score: number;
  focus_score: number;
  planning_score: number;
  overall_score: number;
}

interface ScenarioInput {
  name: string;
  examGrade: number;
  taskBonus?: number;
}

interface ScenarioResult {
  name: string;
  finalGrade: number;
  passed: boolean;
  gapToTarget: number | null;
  assumptions: string;
}

interface PredictionResult {
  moduleId: string;
  moduleName: string;
  currentAverage: number | null;
  targetGrade: number | null;
  predictedGrade: number;
  confidence: number; // 0-100
  passProbability: number; // 0-100
  neededInNextExam: number | null;
  scenarios: ScenarioResult[];
  factors: string[];
}

// ── GET: Auto-predict ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) {
    return NextResponse.json({ error: "moduleId required" }, { status: 400 });
  }

  const prediction = await buildPrediction(supabase, user.id, moduleId);
  if (!prediction) {
    return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ prediction });
}

// ── POST: Custom scenarios ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { moduleId, scenarios } = await req.json();

  if (!moduleId || !Array.isArray(scenarios)) {
    return NextResponse.json({ error: "moduleId and scenarios array required" }, { status: 400 });
  }

  const prediction = await buildPrediction(
    supabase,
    user.id,
    moduleId,
    scenarios as ScenarioInput[]
  );

  if (!prediction) {
    return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ prediction });
}

// ── Core Logic ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPrediction(
  supabase: any,
  userId: string,
  moduleId: string,
  customScenarios?: ScenarioInput[]
): Promise<PredictionResult | null> {
  // Fetch module, grades, exams, and DNA in parallel
  const [moduleRes, gradesRes, examsRes, dnaRes] = await Promise.all([
    supabase.from("modules").select("id, name, ects, target_grade, grading_system").eq("id", moduleId).eq("user_id", userId).maybeSingle(),
    supabase.from("grades").select("id, grade, weight, date, component_type").eq("module_id", moduleId).eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("exams").select("id, title, date, weight, grade").eq("module_id", moduleId).eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("learning_dna_snapshots").select("consistency_score, focus_score, planning_score, overall_score").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const module = moduleRes.data as ModuleRow | null;
  if (!module) return null;

  const grades = (gradesRes.data ?? []) as GradeRow[];
  const exams = (examsRes.data ?? []) as ExamRow[];
  const dna = dnaRes.data as DnaRow | null;

  // Swiss grading: 1 (worst) to 6 (best), pass = 4.0
  const passGrade = 4.0;
  const maxGrade = 6.0;

  // Calculate current weighted average
  const { average: currentAvg, totalWeight: gradeWeight } = weightedAverage(grades);

  // Upcoming exams (no grade yet)
  const upcomingExams = exams.filter((e) => !e.grade && new Date(e.date) >= new Date());
  const completedExams = exams.filter((e) => e.grade != null);

  // Predict next exam grade based on trend + DNA
  const gradeTrend = computeGradeTrend(grades);
  const dnaBoost = dna ? (dna.overall_score - 50) * 0.01 : 0; // ±0.5 max
  const predictedExamGrade = currentAvg != null
    ? clamp(currentAvg + gradeTrend * 0.3 + dnaBoost, 1, maxGrade)
    : passGrade;

  // Calculate needed grade for next exam to reach target
  const target = module.target_grade ?? passGrade;
  const neededGrade = calculateNeededGrade(
    currentAvg,
    gradeWeight,
    target,
    upcomingExams[0]?.weight ?? 1
  );

  // Build auto scenarios
  const autoScenarios: ScenarioResult[] = [
    buildScenario("Best Case", currentAvg, gradeWeight, Math.min(maxGrade, (currentAvg ?? passGrade) + 1), upcomingExams, target, passGrade),
    buildScenario("Realistisch", currentAvg, gradeWeight, predictedExamGrade, upcomingExams, target, passGrade),
    buildScenario("Worst Case", currentAvg, gradeWeight, Math.max(1, (currentAvg ?? passGrade) - 1.5), upcomingExams, target, passGrade),
  ];

  // Add custom scenarios if provided
  const customResults: ScenarioResult[] = (customScenarios ?? []).map((s) =>
    buildScenario(s.name, currentAvg, gradeWeight, s.examGrade, upcomingExams, target, passGrade)
  );

  // Confidence: based on data quality + DNA
  const dataPoints = grades.length + completedExams.length;
  const dataConfidence = Math.min(60, dataPoints * 10);
  const dnaConfidence = dna ? Math.min(30, dna.overall_score * 0.3) : 10;
  const trendConfidence = Math.abs(gradeTrend) < 0.3 ? 10 : 5; // Stable = more confident
  const confidence = clamp(dataConfidence + dnaConfidence + trendConfidence, 10, 95);

  // Pass probability
  const realisticFinal = autoScenarios.find((s) => s.name === "Realistisch")?.finalGrade ?? passGrade;
  const distanceToPass = realisticFinal - passGrade;
  const passProbability = clamp(Math.round(50 + distanceToPass * 25 + (dna?.planning_score ?? 50) * 0.1), 5, 98);

  // Factors
  const factors: string[] = [];
  if (gradeTrend > 0.2) factors.push("Notentrend steigend");
  if (gradeTrend < -0.2) factors.push("Notentrend fallend");
  if (dna && dna.consistency_score > 70) factors.push("Hohe Lernkonsistenz");
  if (dna && dna.consistency_score < 30) factors.push("Niedrige Lernkonsistenz");
  if (upcomingExams.length > 0) factors.push(`${upcomingExams.length} ausstehende Prüfung(en)`);
  if (grades.length === 0) factors.push("Noch keine Noten vorhanden");
  if (neededGrade != null && neededGrade > 5.5) factors.push("Hohe Note in nächster Prüfung nötig");

  return {
    moduleId,
    moduleName: module.name,
    currentAverage: currentAvg,
    targetGrade: module.target_grade,
    predictedGrade: Math.round(realisticFinal * 10) / 10,
    confidence,
    passProbability,
    neededInNextExam: neededGrade != null ? Math.round(neededGrade * 10) / 10 : null,
    scenarios: [...autoScenarios, ...customResults],
    factors,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function weightedAverage(grades: GradeRow[]): { average: number | null; totalWeight: number } {
  if (grades.length === 0) return { average: null, totalWeight: 0 };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const g of grades) {
    const w = g.weight ?? 1;
    weightedSum += g.grade * w;
    totalWeight += w;
  }

  return {
    average: totalWeight > 0 ? weightedSum / totalWeight : null,
    totalWeight,
  };
}

function computeGradeTrend(grades: GradeRow[]): number {
  if (grades.length < 2) return 0;

  // Simple linear regression on grade values
  const n = grades.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += grades[i].grade;
    sumXY += i * grades[i].grade;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

function calculateNeededGrade(
  currentAvg: number | null,
  currentWeight: number,
  target: number,
  nextWeight: number
): number | null {
  if (currentAvg == null || currentWeight === 0) return null;

  // target = (currentAvg * currentWeight + needed * nextWeight) / (currentWeight + nextWeight)
  // needed = (target * (currentWeight + nextWeight) - currentAvg * currentWeight) / nextWeight
  const needed =
    (target * (currentWeight + nextWeight) - currentAvg * currentWeight) / nextWeight;

  return needed;
}

function buildScenario(
  name: string,
  currentAvg: number | null,
  currentWeight: number,
  examGrade: number,
  upcomingExams: ExamRow[],
  target: number,
  passGrade: number
): ScenarioResult {
  const examWeight = upcomingExams[0]?.weight ?? 1;

  let finalGrade: number;
  if (currentAvg != null && currentWeight > 0) {
    finalGrade = (currentAvg * currentWeight + examGrade * examWeight) / (currentWeight + examWeight);
  } else {
    finalGrade = examGrade;
  }

  finalGrade = Math.round(finalGrade * 10) / 10;

  return {
    name,
    finalGrade,
    passed: finalGrade >= passGrade,
    gapToTarget: Math.round((finalGrade - target) * 10) / 10,
    assumptions: `Prüfungsnote: ${examGrade.toFixed(1)}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
