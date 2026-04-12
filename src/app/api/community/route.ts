import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams;
  const programId = url.get("program_id") || undefined;
  const semester = url.get("semester") ? parseInt(url.get("semester")!) : undefined;
  const search = url.get("search") || undefined;
  const limit = parseInt(url.get("limit") || "50");
  const offset = parseInt(url.get("offset") || "0");

  // Get user's institution
  const { data: profile } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .single();

  if (!profile?.institution_id) {
    return NextResponse.json({ members: [], total: 0, programs: [] });
  }

  // Get community members via RPC
  const { data: members, error } = await supabase.rpc("get_community_members", {
    p_institution_id: profile.institution_id,
    p_program_id: programId || null,
    p_semester: semester || null,
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("Community members error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get total count
  const { data: countResult } = await supabase.rpc("get_community_member_count", {
    p_institution_id: profile.institution_id,
    p_program_id: programId || null,
    p_semester: semester || null,
    p_search: search || null,
  });

  // Get programs at this institution (for filter dropdown)
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, degree_level")
    .eq("institution_id", profile.institution_id)
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({
    members: members || [],
    total: countResult || 0,
    programs: programs || [],
  });
}
