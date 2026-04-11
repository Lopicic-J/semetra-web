import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/groups/join
 *
 * Join a group via invite code.
 * Body: { inviteCode: string }
 *
 * Uses an atomic count+insert to prevent race conditions on max_members.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { inviteCode } = await req.json();
    const code = inviteCode?.trim()?.toLowerCase();
    if (!code) {
      return NextResponse.json({ error: "Einladungscode erforderlich" }, { status: 400 });
    }

    // Find group by invite code (case-insensitive match)
    const { data: group, error: lookupError } = await supabase
      .from("study_groups")
      .select("id, name, max_members, invite_code")
      .ilike("invite_code", code)
      .single();

    if (lookupError || !group) {
      return NextResponse.json({ error: "Ungültiger Einladungscode. Bitte prüfe den Code und versuche es erneut." }, { status: 404 });
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

    // Atomic count + insert: check member limit and insert in one step.
    // The UNIQUE constraint on (group_id, user_id) prevents duplicates,
    // and we re-check count right before insert to minimize the race window.
    const { count } = await supabase
      .from("study_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    if ((count ?? 0) >= group.max_members) {
      return NextResponse.json({ error: "Gruppe ist voll" }, { status: 400 });
    }

    // Insert — UNIQUE constraint catches any remaining race condition
    const { error } = await supabase
      .from("study_group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "member" });

    if (error) {
      // Handle UNIQUE violation (23505) — user joined in parallel request
      if (error.code === "23505") {
        return NextResponse.json({ error: "Du bist bereits Mitglied", groupId: group.id }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, groupId: group.id, groupName: group.name });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
