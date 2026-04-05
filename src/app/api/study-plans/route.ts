import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:study-plans");

interface TopicForPlan {
  id: string;
  title: string;
  knowledge_level: number;
  exam_id: string | null;
}

interface ExamForPlan {
  id: string;
  title: string;
  start_dt: string;
  color: string;
  topics: TopicForPlan[];
  daysLeft: number;
}

/**
 * GET /api/study-plans
 *
 * List user's study plans. ?status=active (default)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";

    const { data, error } = await supabase
      .from("study_plans")
      .select("*, study_plan_items(id, scheduled_date, title, duration_minutes, item_type, priority, completed, completed_at, sort_order, topic_id)")
      .eq("user_id", user.id)
      .eq("status", status)
      .order("start_date", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plans: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/study-plans
 *
 * Auto-generate a study plan from upcoming exams.
 * Body: { examId?: string, strategy?: "balanced" | "intensive" | "spaced" }
 *
 * If examId is given, generates plan for that specific exam.
 * Otherwise, generates plan for all upcoming exams in the next 30 days.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    const { examId, strategy = "balanced" } = body;

    // Fetch upcoming exams with topics
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let examQuery = supabase
      .from("events")
      .select("id, title, start_dt, color")
      .eq("user_id", user.id)
      .eq("event_type", "exam")
      .gte("start_dt", now.toISOString())
      .lte("start_dt", in30Days.toISOString())
      .order("start_dt", { ascending: true });

    if (examId) {
      examQuery = examQuery.eq("id", examId);
    }

    const { data: exams } = await examQuery;
    if (!exams || exams.length === 0) {
      return NextResponse.json({ error: "Keine anstehenden Prüfungen gefunden" }, { status: 404 });
    }

    // Fetch all topics for these exams
    const examIds = exams.map(e => e.id);
    const { data: allTopics } = await supabase
      .from("topics")
      .select("id, title, knowledge_level, exam_id")
      .in("exam_id", examIds);

    // Build exam objects with topics
    const examsWithTopics: ExamForPlan[] = exams.map(e => ({
      ...e,
      color: e.color || "#6d28d9",
      daysLeft: Math.max(0, Math.ceil((new Date(e.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      topics: (allTopics || []).filter(t => t.exam_id === e.id).map(t => ({
        ...t,
        knowledge_level: t.knowledge_level ?? 0,
      })),
    }));

    // Generate the plan
    const planTitle = examId
      ? `Lernplan: ${exams[0].title}`
      : `Lernplan ${now.toLocaleDateString("de-CH")}`;

    const endDate = examId
      ? new Date(exams[0].start_dt)
      : in30Days;

    // Create plan
    const { data: plan, error: planErr } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        title: planTitle,
        exam_id: examId || null,
        start_date: now.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        status: "active",
        strategy,
      })
      .select()
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: planErr?.message || "Plan-Erstellung fehlgeschlagen" }, { status: 500 });
    }

    // Generate daily items
    const items = generateDailyItems(examsWithTopics, plan.id, now, endDate, strategy);

    if (items.length > 0) {
      const { error: itemsErr } = await supabase
        .from("study_plan_items")
        .insert(items);

      if (itemsErr) {
        log.error("[study-plans POST] items insert error", itemsErr);
      }

      // Update plan total
      await supabase
        .from("study_plans")
        .update({ total_items: items.length })
        .eq("id", plan.id);
    }

    // Reload plan with items
    const { data: fullPlan } = await supabase
      .from("study_plans")
      .select("*, study_plan_items(*)")
      .eq("id", plan.id)
      .single();

    return NextResponse.json({ plan: fullPlan }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * Generate daily study plan items using spaced repetition principles.
 */
function generateDailyItems(
  exams: ExamForPlan[],
  planId: string,
  startDate: Date,
  endDate: Date,
  strategy: string,
): Array<{
  plan_id: string;
  scheduled_date: string;
  topic_id: string | null;
  title: string;
  description: string;
  duration_minutes: number;
  item_type: string;
  priority: string;
  sort_order: number;
}> {
  const items: Array<{
    plan_id: string;
    scheduled_date: string;
    topic_id: string | null;
    title: string;
    description: string;
    duration_minutes: number;
    item_type: string;
    priority: string;
    sort_order: number;
  }> = [];

  // Collect all topics that need work
  const topicQueue: Array<{
    topic: TopicForPlan;
    examTitle: string;
    daysLeft: number;
    gap: number;
    urgencyScore: number;
  }> = [];

  for (const exam of exams) {
    for (const topic of exam.topics) {
      if (topic.knowledge_level >= 4) continue;
      const gap = 4 - topic.knowledge_level;
      const urgencyScore = gap * (exam.daysLeft <= 3 ? 3 : exam.daysLeft <= 7 ? 2 : exam.daysLeft <= 14 ? 1.5 : 1);
      topicQueue.push({ topic, examTitle: exam.title, daysLeft: exam.daysLeft, gap, urgencyScore });
    }
  }

  // Sort by urgency
  topicQueue.sort((a, b) => b.urgencyScore - a.urgencyScore);

  if (topicQueue.length === 0) return items;

  // Calculate available days
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const itemsPerDay = strategy === "intensive" ? 6 : strategy === "spaced" ? 3 : 4;
  const sessionMinutes = strategy === "intensive" ? 45 : strategy === "spaced" ? 25 : 30;

  // Distribute topics across days
  for (let day = 0; day < totalDays && day < 30; day++) {
    const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    let dailyCount = 0;

    for (const entry of topicQueue) {
      if (dailyCount >= itemsPerDay) break;

      // Schedule topic based on spaced repetition intervals
      const shouldSchedule = shouldStudyOnDay(day, entry.gap, entry.daysLeft, totalDays, strategy);
      if (!shouldSchedule) continue;

      // Determine item type based on gap and day
      const itemType = entry.gap >= 3 ? "review"
        : entry.gap >= 2 ? (day % 2 === 0 ? "review" : "practice")
        : (day % 3 === 0 ? "flashcards" : day % 3 === 1 ? "practice" : "summary");

      const priority = entry.daysLeft <= 3 ? "high" : entry.daysLeft <= 7 ? "medium" : "low";

      items.push({
        plan_id: planId,
        scheduled_date: dateStr,
        topic_id: entry.topic.id,
        title: entry.topic.title,
        description: `${entry.examTitle} — ${getItemTypeLabel(itemType)}`,
        duration_minutes: sessionMinutes,
        item_type: itemType,
        priority,
        sort_order: dailyCount,
      });

      dailyCount++;
    }

    // Add a break after every 3 study items
    if (dailyCount >= 3 && strategy !== "intensive") {
      items.push({
        plan_id: planId,
        scheduled_date: dateStr,
        topic_id: null,
        title: "Pause",
        description: "Kurze Erholung — Bewegung, Snack, frische Luft",
        duration_minutes: 15,
        item_type: "break",
        priority: "low",
        sort_order: dailyCount,
      });
    }

    // Add mock exam day before the actual exam
    for (const exam of exams) {
      const examDate = new Date(exam.daysLeft * 24 * 60 * 60 * 1000 + startDate.getTime());
      const dayBefore = new Date(examDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (dateStr === dayBefore && exam.topics.length > 0) {
        items.push({
          plan_id: planId,
          scheduled_date: dateStr,
          topic_id: null,
          title: `Probe-Prüfung: ${exam.title}`,
          description: "Simuliere die Prüfungssituation — alle Themen durchgehen",
          duration_minutes: 60,
          item_type: "mock_exam",
          priority: "high",
          sort_order: dailyCount + 1,
        });
      }
    }
  }

  return items;
}

function shouldStudyOnDay(
  day: number,
  gap: number,
  daysLeft: number,
  totalDays: number,
  strategy: string,
): boolean {
  if (day >= daysLeft) return false; // Past the exam

  if (strategy === "intensive") return true; // Study every day

  // Spaced repetition: study more frequently for topics with larger gaps
  if (gap >= 3) return day % 1 === 0; // Every day
  if (gap >= 2) return day % 2 === 0; // Every other day
  return day % 3 === 0; // Every 3rd day for almost-mastered topics
}

function getItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    review: "Stoff wiederholen",
    practice: "Übungsaufgaben lösen",
    flashcards: "Karteikarten durchgehen",
    summary: "Zusammenfassung erstellen",
    mock_exam: "Probe-Prüfung",
    break: "Pause",
  };
  return labels[type] || type;
}
