import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api/auth";

/**
 * GET /api/v1/modules
 *
 * Public API: List user's modules.
 * Requires: Bearer token with "read" + "modules" scope.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "modules");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select("id, name, code, ects, semester, status, module_type, professor, exam_date, color, created_at, updated_at")
    .eq("user_id", auth.userId)
    .order("semester")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    meta: { count: data?.length ?? 0, api_version: "v1" },
  });
}
