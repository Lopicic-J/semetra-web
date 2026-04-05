import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/study-plans/[id]
 *
 * Fetch a single study plan with all items.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { data, error } = await supabase
      .from("study_plans")
      .select("*, study_plan_items(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ plan: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * PATCH /api/study-plans/[id]
 *
 * Update plan metadata or toggle item completion.
 *
 * Body options:
 *   { title?: string, status?: string }  — update plan itself
 *   { itemId: string, completed: boolean } — toggle a single item
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Verify ownership
    const { data: plan } = await supabase
      .from("study_plans")
      .select("id, user_id, total_items, completed_items")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!plan) return NextResponse.json({ error: "Plan nicht gefunden" }, { status: 404 });

    const body = await req.json();

    // ── Toggle item completion ──────────────────────────────────────
    if (body.itemId) {
      const completed = !!body.completed;
      const { error: itemErr } = await supabase
        .from("study_plan_items")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", body.itemId)
        .eq("plan_id", id);

      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

      // Recalculate completed count
      const { count } = await supabase
        .from("study_plan_items")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", id)
        .eq("completed", true);

      const completedItems = count ?? 0;
      const newStatus = completedItems >= (plan.total_items || 0) && plan.total_items > 0
        ? "completed"
        : "active";

      await supabase
        .from("study_plans")
        .update({ completed_items: completedItems, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      return NextResponse.json({ ok: true, completed_items: completedItems, status: newStatus });
    }

    // ── Update plan metadata ────────────────────────────────────────
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title) updates.title = body.title;
    if (body.status) updates.status = body.status;

    const { error: updateErr } = await supabase
      .from("study_plans")
      .update(updates)
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/study-plans/[id]
 *
 * Delete a study plan (cascades items via FK).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { error } = await supabase
      .from("study_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
