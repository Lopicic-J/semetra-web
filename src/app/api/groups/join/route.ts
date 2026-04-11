import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/groups/join
 *
 * Join a group via invite code.
 * Uses a SECURITY DEFINER RPC function to bypass RLS.
 * Body: { inviteCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { inviteCode } = await req.json();
    const code = inviteCode?.trim();
    if (!code) {
      return NextResponse.json({ error: "Einladungscode erforderlich" }, { status: 400 });
    }

    // Call the SECURITY DEFINER function that bypasses RLS
    const { data, error } = await supabase.rpc("join_group_by_invite", {
      invite_code_input: code,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The function returns a jsonb object with either { ok, group_id, group_name } or { error, status }
    if (data?.error) {
      return NextResponse.json(
        { error: data.error, groupId: data.group_id },
        { status: data.status || 400 },
      );
    }

    return NextResponse.json({ ok: true, groupId: data.group_id, groupName: data.group_name });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
