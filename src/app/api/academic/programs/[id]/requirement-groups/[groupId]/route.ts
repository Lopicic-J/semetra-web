import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/academic/programs/[id]/requirement-groups/[groupId]
 *
 * Delete a requirement group from a program.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  try {
    const { id, groupId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Verify group belongs to this program
    const { data: existing, error: existingError } = await supabase
      .from("program_requirement_groups")
      .select("id, program_id")
      .eq("id", groupId)
      .eq("program_id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Anforderungsgruppe nicht gefunden" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("program_requirement_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      console.error("[academic/programs/[id]/requirement-groups/[groupId] DELETE]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[academic/programs/[id]/requirement-groups/[groupId] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
