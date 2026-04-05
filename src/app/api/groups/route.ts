import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/groups
 *
 * List all groups the current user is a member of.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { data: memberships } = await supabase
      .from("study_group_members")
      .select("role, group_id, study_groups(id, name, description, color, invite_code, owner_id, max_members, created_at)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    const groups = (memberships ?? []).map(m => ({
      ...(m.study_groups as unknown as Record<string, unknown>),
      myRole: m.role,
    }));

    return NextResponse.json({ groups });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/groups
 *
 * Create a new study group.
 * Body: { name, description?, color? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { name, description, color } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    const { data: group, error } = await supabase
      .from("study_groups")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#6d28d9",
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Owner is auto-added via trigger, return group
    return NextResponse.json({ group });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
