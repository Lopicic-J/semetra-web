import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:module-components");

/**
 * DELETE /api/academic/modules/[id]/components/[componentId]
 *
 * Delete an assessment component.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const { id, componentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Verify component belongs to this module
    const { data: existing, error: existingError } = await supabase
      .from("assessment_components")
      .select("id, module_id")
      .eq("id", componentId)
      .eq("module_id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Komponente nicht gefunden" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("assessment_components")
      .delete()
      .eq("id", componentId);

    if (error) {
      log.error("DELETE failed", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
