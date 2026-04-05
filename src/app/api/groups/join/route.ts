import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/groups/join
 *
 * Join a group via invite code.
 * Body: { inviteCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { inviteCode } = await req.json();
    if (!inviteCode?.trim()) {
      return NextResponse.json({ error: "Einladungscode erforderlich" }, { status: 400 });
    }

    // Find group by invite code
    const { data: group } = await supabase
      .from("study_groups")
      .select("id, name, max_members")
      .eq("invite_code", inviteCode.trim().toLowerCase())
      .single();

    if (!group) {
      return NextResponse.json({ error: "Ungültiger Einladungscode" }, { status: 404 });
    }

    // Check if already member
    const { data: existing } = await supabase
      .from("study_group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Du bist bereits Mitglied", groupId: group.id }, { status: 409 });
    }

    // Check member limit
    const { count } = await supabase
      .from("study_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    if ((count ?? 0) >= group.max_members) {
      return NextResponse.json({ error: "Gruppe ist voll" }, { status: 400 });
    }

    // Join
    const { error } = await supabase
      .from("study_group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "member" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, groupId: group.id, groupName: group.name });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
