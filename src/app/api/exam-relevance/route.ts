/**
 * /api/exam-relevance — Exam Relevance Management
 *
 * PATCH: Toggle exam relevance on topics + update module exam notes
 *
 * Body options:
 * - { topicId, isExamRelevant, note? } — Toggle single topic
 * - { moduleId, examNotes } — Update module exam notes
 * - { moduleId, topicIds, isExamRelevant } — Bulk toggle topics
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Option 1: Toggle single topic
  if (body.topicId) {
    const { topicId, isExamRelevant, note } = body;
    const updates: Record<string, unknown> = { is_exam_relevant: isExamRelevant ?? true };
    if (note !== undefined) updates.exam_relevance_note = note;

    const { error } = await supabase
      .from("topics")
      .update(updates)
      .eq("id", topicId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: true });
  }

  // Option 2: Update module exam notes
  if (body.moduleId && body.examNotes !== undefined) {
    const { moduleId, examNotes } = body;
    const { error } = await supabase
      .from("modules")
      .update({ exam_notes: examNotes })
      .eq("id", moduleId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: true });
  }

  // Option 3: Bulk toggle topics
  if (body.moduleId && body.topicIds && Array.isArray(body.topicIds)) {
    const { topicIds, isExamRelevant } = body;
    const { error } = await supabase
      .from("topics")
      .update({ is_exam_relevant: isExamRelevant ?? true })
      .in("id", topicIds)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: true, count: topicIds.length });
  }

  return NextResponse.json({ error: "topicId or moduleId+examNotes required" }, { status: 400 });
}

/**
 * GET ?moduleId=<uuid>: Get exam relevance status for all topics in a module
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId required" }, { status: 400 });

  const [topicsRes, moduleRes] = await Promise.all([
    supabase.from("topics")
      .select("id, title, is_exam_relevant, exam_relevance_note, knowledge_level")
      .eq("module_id", moduleId)
      .eq("user_id", user.id)
      .order("title"),
    supabase.from("modules")
      .select("exam_notes, exam_format")
      .eq("id", moduleId)
      .eq("user_id", user.id)
      .single(),
  ]);

  const topics = topicsRes.data ?? [];
  const examRelevantCount = topics.filter((t: any) => t.is_exam_relevant).length;

  return NextResponse.json({
    topics,
    examNotes: moduleRes.data?.exam_notes ?? null,
    examFormat: moduleRes.data?.exam_format ?? null,
    stats: {
      total: topics.length,
      examRelevant: examRelevantCount,
      notRelevant: topics.length - examRelevantCount,
    },
  });
}
