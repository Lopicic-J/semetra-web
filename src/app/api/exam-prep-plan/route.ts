/**
 * /api/exam-prep-plan — Structured Exam Preparation Plan
 *
 * GET ?examId=<uuid>: Get existing prep plan for an exam
 * POST: Generate a new prep plan based on Decision Engine analysis
 * PATCH: Update progress (mark activities as completed)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface DayPlan {
  date: string;
  dayNumber: number;     // 1 = first day, N = exam day
  daysUntilExam: number;
  focus: string;          // "Schwächen identifizieren", "Vertiefung", etc.
  activities: {
    type: "flashcards" | "review" | "exercises" | "mock_exam" | "summary" | "weak_topics" | "formula_sheet" | "rest";
    title: string;
    description: string;
    duration_min: number;
    topicId?: string;
    topicTitle?: string;
    completed: boolean;
  }[];
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");

  let query = supabase
    .from("exam_prep_plans")
    .select("*, modules(name, color), events(title, start_dt)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (examId) query = query.eq("exam_id", examId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { examId, prepDays = 5 } = body;

  if (!examId) return NextResponse.json({ error: "examId required" }, { status: 400 });

  // Get exam details (validate ownership via RLS — events table has user_id)
  const { data: exam } = await supabase
    .from("events")
    .select("id, title, start_dt, module_id")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();

  if (!exam) return NextResponse.json({ error: "Prüfung nicht gefunden" }, { status: 404 });

  const examDate = new Date(exam.start_dt);
  const now = new Date();
  const daysUntil = Math.ceil((examDate.getTime() - now.getTime()) / 86400000);
  const actualPrepDays = Math.min(prepDays, Math.max(1, daysUntil));

  // Get module context
  const moduleId = exam.module_id;

  // Fetch topic and grade data for this module
  const [topicsRes, gradesRes, flashcardsRes] = await Promise.all([
    supabase.from("topics").select("id, title, knowledge_level, is_exam_relevant")
      .eq("module_id", moduleId).order("knowledge_level", { ascending: true }),
    supabase.from("grades").select("grade, title, exam_type")
      .eq("module_id", moduleId),
    supabase.from("flashcards").select("id")
      .eq("module_id", moduleId),
  ]);

  const topics = topicsRes.data ?? [];
  const flashcardCount = flashcardsRes.data?.length ?? 0;
  // Prioritize exam-relevant topics — they should appear first in the plan
  const examRelevantTopics = topics.filter((t: any) => t.is_exam_relevant);
  const weakTopics = examRelevantTopics.length > 0
    ? examRelevantTopics.filter(t => (t.knowledge_level ?? 0) < 50)  // Exam-relevant + weak = highest priority
    : topics.filter(t => (t.knowledge_level ?? 0) < 50);
  const mediumTopics = (examRelevantTopics.length > 0 ? examRelevantTopics : topics)
    .filter(t => (t.knowledge_level ?? 0) >= 50 && (t.knowledge_level ?? 0) < 80);

  // Generate day-by-day plan
  const dailyPlan: DayPlan[] = [];
  const startDate = new Date(examDate);
  startDate.setDate(startDate.getDate() - actualPrepDays);

  for (let day = 0; day < actualPrepDays; day++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day);
    const daysLeft = actualPrepDays - day;
    const dateStr = date.toISOString().split("T")[0];

    const activities: DayPlan["activities"] = [];

    if (day === 0) {
      // Day 1: Assessment — identify all weaknesses
      activities.push({
        type: "review",
        title: "Alle Topics durchgehen",
        description: "Lies jedes Thema kurz durch und bewerte dein Verständnis ehrlich",
        duration_min: 20,
        completed: false,
      });
      if (weakTopics.length > 0) {
        activities.push({
          type: "weak_topics",
          title: `${weakTopics.length} schwache Themen identifiziert`,
          description: `Fokus-Themen: ${weakTopics.slice(0, 3).map(t => t.title).join(", ")}${weakTopics.length > 3 ? ` +${weakTopics.length - 3} weitere` : ""}`,
          duration_min: 30,
          topicId: weakTopics[0]?.id,
          topicTitle: weakTopics[0]?.title,
          completed: false,
        });
      }
      if (flashcardCount > 0) {
        activities.push({
          type: "flashcards",
          title: "Flashcard-Durchlauf",
          description: `${flashcardCount} Karten — alle einmal durchgehen, fällige priorisieren`,
          duration_min: Math.min(30, Math.ceil(flashcardCount / 3)),
          completed: false,
        });
      }

      dailyPlan.push({ date: dateStr, dayNumber: day + 1, daysUntilExam: daysLeft, focus: "Bestandsaufnahme", activities });

    } else if (day < actualPrepDays - 2) {
      // Middle days: Deep work on weak topics
      const dayWeakTopics = weakTopics.slice(day * 2, day * 2 + 2);
      const dayMediumTopics = mediumTopics.slice(day, day + 1);

      for (const topic of dayWeakTopics) {
        activities.push({
          type: "weak_topics",
          title: `Vertiefen: ${topic.title}`,
          description: `Wissenslevel: ${topic.knowledge_level ?? 0}% — Konzepte nochmal durcharbeiten, Übungen machen`,
          duration_min: 30,
          topicId: topic.id,
          topicTitle: topic.title,
          completed: false,
        });
      }

      if (dayWeakTopics.length === 0 && dayMediumTopics.length > 0) {
        for (const topic of dayMediumTopics) {
          activities.push({
            type: "review",
            title: `Festigen: ${topic.title}`,
            description: `Wissenslevel: ${topic.knowledge_level ?? 0}% — Details und Randthemen`,
            duration_min: 25,
            topicId: topic.id,
            topicTitle: topic.title,
            completed: false,
          });
        }
      }

      activities.push({
        type: "exercises",
        title: "Übungsaufgaben lösen",
        description: "Aufgaben zu den heutigen Themen bearbeiten",
        duration_min: 25,
        completed: false,
      });

      activities.push({
        type: "flashcards",
        title: "Flashcard-Review",
        description: "Fällige Karten durchgehen",
        duration_min: 15,
        completed: false,
      });

      dailyPlan.push({ date: dateStr, dayNumber: day + 1, daysUntilExam: daysLeft, focus: "Vertiefung", activities });

    } else if (day === actualPrepDays - 2) {
      // Second to last day: Mock exam
      activities.push({
        type: "mock_exam",
        title: "Prüfungssimulation",
        description: "Vollständige Mock-Prüfung unter realen Bedingungen durcharbeiten",
        duration_min: 45,
        completed: false,
      });
      activities.push({
        type: "review",
        title: "Fehleranalyse",
        description: "Alle falschen Antworten verstehen und die Themen nochmal durchgehen",
        duration_min: 20,
        completed: false,
      });
      activities.push({
        type: "formula_sheet",
        title: "Formelblatt erstellen",
        description: "Alle wichtigen Formeln, Definitionen und Merksätze zusammenfassen",
        duration_min: 20,
        completed: false,
      });

      dailyPlan.push({ date: dateStr, dayNumber: day + 1, daysUntilExam: daysLeft, focus: "Simulation & Zusammenfassung", activities });

    } else {
      // Last day before exam: Light review + rest
      activities.push({
        type: "flashcards",
        title: "Letzter Flashcard-Durchgang",
        description: "Nur die schwierigsten Karten nochmal",
        duration_min: 15,
        completed: false,
      });
      activities.push({
        type: "review",
        title: "Formelblatt durchlesen",
        description: "Alles einmal überfliegen, nicht neu lernen",
        duration_min: 15,
        completed: false,
      });
      activities.push({
        type: "rest",
        title: "Früh schlafen",
        description: "Genug Schlaf ist wichtiger als eine letzte Lernsession. Du bist vorbereitet!",
        duration_min: 0,
        completed: false,
      });

      dailyPlan.push({ date: dateStr, dayNumber: day + 1, daysUntilExam: daysLeft, focus: "Letzte Revision & Erholung", activities });
    }
  }

  const totalActivities = dailyPlan.reduce((s, d) => s + d.activities.length, 0);

  // Upsert plan
  const { data: plan, error } = await supabase
    .from("exam_prep_plans")
    .upsert({
      user_id: user.id,
      exam_id: examId,
      module_id: moduleId,
      exam_date: examDate.toISOString().split("T")[0],
      plan_start_date: startDate.toISOString().split("T")[0],
      total_days: actualPrepDays,
      daily_plan: dailyPlan,
      activities_total: totalActivities,
      activities_completed: 0,
      days_completed: 0,
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,exam_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    plan,
    generated: true,
    summary: {
      examTitle: exam.title,
      daysUntilExam: daysUntil,
      prepDays: actualPrepDays,
      totalActivities,
      weakTopicCount: weakTopics.length,
      flashcardCount,
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { planId, dayIndex, activityIndex, completed } = body;

  if (!planId || dayIndex === undefined || activityIndex === undefined) {
    return NextResponse.json({ error: "planId, dayIndex, activityIndex required" }, { status: 400 });
  }

  // Load current plan
  const { data: plan } = await supabase
    .from("exam_prep_plans")
    .select("daily_plan, activities_completed, days_completed")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Update the specific activity
  const dailyPlan = plan.daily_plan as DayPlan[];
  if (!dailyPlan[dayIndex]?.activities[activityIndex]) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const wasCompleted = dailyPlan[dayIndex].activities[activityIndex].completed;
  dailyPlan[dayIndex].activities[activityIndex].completed = completed ?? true;

  // Recalculate progress
  let activitiesCompleted = 0;
  let daysCompleted = 0;
  for (const day of dailyPlan) {
    const dayDone = day.activities.every(a => a.completed || a.type === "rest");
    if (dayDone) daysCompleted++;
    activitiesCompleted += day.activities.filter(a => a.completed).length;
  }

  const { error } = await supabase
    .from("exam_prep_plans")
    .update({
      daily_plan: dailyPlan,
      activities_completed: activitiesCompleted,
      days_completed: daysCompleted,
      status: daysCompleted === dailyPlan.length ? "completed" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    updated: true,
    activitiesCompleted,
    daysCompleted,
    totalDays: dailyPlan.length,
  });
}
