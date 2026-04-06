import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/groups/[id]
 *
 * Fetch group details + members + shared resources.
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

    // Verify membership
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });

    // Fetch group, members, and shared resources in parallel
    const [groupRes, membersRes, sharesRes] = await Promise.all([
      supabase.from("study_groups").select("*").eq("id", id).single(),
      supabase
        .from("study_group_members")
        .select("*, profiles(username, full_name, avatar_url)")
        .eq("group_id", id)
        .order("joined_at"),
      supabase
        .from("group_shares")
        .select("*, profiles!shared_by(username, full_name)")
        .eq("group_id", id)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      group: groupRes.data,
      members: membersRes.data ?? [],
      shares: sharesRes.data ?? [],
      myRole: membership.role,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * PATCH /api/groups/[id]
 *
 * Update group settings (owner/admin only).
 * Body: { name?, description?, color? }
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

    // Check if user is owner or admin
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Nur Owner und Admins dürfen die Gruppe bearbeiten" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.color) updates.color = body.color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
    }

    const { error } = await supabase
      .from("study_groups")
      .update(updates)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/groups/[id]
 *
 * Delete group (owner only). Cascades members + shares.
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

    // Verify ownership first
    const { data: group } = await supabase
      .from("study_groups")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (!group) {
      return NextResponse.json({ error: "Gruppe nicht gefunden oder keine Berechtigung" }, { status: 404 });
    }

    const { error } = await supabase
      .from("study_groups")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
