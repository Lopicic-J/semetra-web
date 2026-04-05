import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api/auth";

/**
 * GET /api/v1/grades
 *
 * Public API: List user's grades.
 * Requires: Bearer token with "read" + "grades" scope.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "grades");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("id, module_id, value, weight, exam_type, date, notes, created_at")
    .eq("user_id", auth.userId)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    meta: { count: data?.length ?? 0, api_version: "v1" },
  });
}
