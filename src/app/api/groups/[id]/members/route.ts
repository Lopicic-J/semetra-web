import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/groups/[id]/members
 *
 * Add a member to the group (admin/owner only).
 * Body: { username } or handled via invite code in /api/groups/join
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Verify admin/owner role
    const { data: myMembership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { username } = await req.json();
    if (!username) return NextResponse.json({ error: "Username erforderlich" }, { status: 400 });

    // Look up user
    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (!target) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

    // Check max members
    const { count } = await supabase
      .from("study_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id);

    const { data: group } = await supabase
      .from("study_groups")
      .select("max_members")
      .eq("id", id)
      .single();

    if ((count ?? 0) >= (group?.max_members ?? 20)) {
      return NextResponse.json({ error: "Gruppe ist voll" }, { status: 400 });
    }

    const { error } = await supabase
      .from("study_group_members")
      .insert({ group_id: id, user_id: target.id, role: "member" });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Bereits Mitglied" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * PATCH /api/groups/[id]/members
 *
 * Change member role (admin/owner only).
 * Body: { userId, role }
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

    const { userId, role } = await req.json();
    if (!userId || !role) {
      return NextResponse.json({ error: "userId und role erforderlich" }, { status: 400 });
    }

    if (!["member", "admin"].includes(role)) {
      return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 });
    }

    // Verify caller is owner or admin
    const { data: myMembership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Can't change owner's role (only owner can remove their own status)
    const { data: targetMembership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", userId)
      .single();

    if (!targetMembership) {
      return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Rolle des Besitzers kann nicht geändert werden" }, { status: 400 });
    }

    // Only owner can promote to admin
    if (role === "admin" && myMembership.role !== "owner") {
      return NextResponse.json({ error: "Nur der Besitzer kann zu Admin befördern" }, { status: 403 });
    }

    const { error } = await supabase
      .from("study_group_members")
      .update({ role })
      .eq("group_id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/groups/[id]/members
 *
 * Remove a member (admin/owner) or leave the group (self).
 * Body: { userId }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { userId } = await req.json();
    const targetId = userId || user.id;

    // If removing someone else, verify admin role
    if (targetId !== user.id) {
      const { data: myMembership } = await supabase
        .from("study_group_members")
        .select("role")
        .eq("group_id", id)
        .eq("user_id", user.id)
        .single();

      if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
        return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
      }
    }

    // Don't allow owner to leave (must delete group instead)
    const { data: targetMembership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", targetId)
      .single();

    if (targetMembership?.role === "owner") {
      return NextResponse.json({ error: "Gruppenbesitzer kann nicht entfernt werden" }, { status: 400 });
    }

    const { error } = await supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", id)
      .eq("user_id", targetId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
