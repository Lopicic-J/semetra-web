/**
 * /api/topic-resources — Learning Resources per Topic
 *
 * GET: List resources for a topic
 * POST: Add a resource (link, video, formula, etc.)
 * PATCH: Update resource (toggle recommended, update content)
 * DELETE: Remove resource
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId");
  const moduleId = url.searchParams.get("moduleId");

  let query = supabase
    .from("topic_resources")
    .select("*, topics(title)")
    .eq("user_id", user.id)
    .order("is_recommended", { ascending: false })
    .order("created_at", { ascending: false });

  if (topicId) query = query.eq("topic_id", topicId);
  else if (moduleId) query = query.eq("module_id", moduleId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resources: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { topicId, moduleId, title, url: resourceUrl, content, resourceType, tags } = body;

  if (!topicId || !title) {
    return NextResponse.json({ error: "topicId and title required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("topic_resources")
    .insert({
      user_id: user.id,
      topic_id: topicId,
      module_id: moduleId ?? null,
      title,
      url: resourceUrl ?? null,
      content: content ?? null,
      resource_type: resourceType ?? "link",
      tags: tags ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resource: data, created: true });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Map camelCase to snake_case
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.url !== undefined) dbUpdates.url = updates.url;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.resourceType !== undefined) dbUpdates.resource_type = updates.resourceType;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.isRecommended !== undefined) dbUpdates.is_recommended = updates.isRecommended;

  const { error } = await supabase
    .from("topic_resources")
    .update(dbUpdates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("topic_resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
