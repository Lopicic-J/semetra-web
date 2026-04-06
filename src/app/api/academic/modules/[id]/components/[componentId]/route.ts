import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireAuth,
  canManageInstitution,
  logBuilderAction,
  errorResponse,
  createServiceClient,
  type UserRole,
} from "@/lib/api-helpers";

const log = logger("api:module-components");

/**
 * DELETE /api/academic/modules/[id]/components/[componentId]
 *
 * Delete an assessment component.
 * Owner or institution/platform admin can delete.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const { id, componentId } = await params;
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;
    const db = createServiceClient();

    // Get user's builder role
    const { data: profile } = await db
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .single();

    const userRole = (profile?.user_role as UserRole) ?? "non_student";

    // Verify component belongs to this module and get module info
    const { data: existing, error: existingError } = await db
      .from("assessment_components")
      .select("id, module_id")
      .eq("id", componentId)
      .eq("module_id", id)
      .single();

    if (existingError || !existing) {
      return errorResponse("Komponente nicht gefunden", 404);
    }

    // Get module info to check ownership
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("user_id, program_id, source")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Check permissions: owner or admin
    const isOwner = module.user_id === user.id;
    const isAdmin = ["admin", "institution"].includes(userRole);

    // Students with imported institution modules (not the creator) cannot edit
    if (!isOwner && !isAdmin) {
      return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
    }

    // Institution admins: verify they manage the institution
    if (!isOwner && isAdmin && userRole === "institution" && module.program_id) {
      const { data: program } = await db
        .from("programs")
        .select("institution_id")
        .eq("id", module.program_id)
        .single();

      if (program && !(await canManageInstitution(db, user.id, program.institution_id, userRole))) {
        return errorResponse("Keine Berechtigung zur Bearbeitung dieses Moduls", 403);
      }
    }

    const { error } = await db
      .from("assessment_components")
      .delete()
      .eq("id", componentId);

    if (error) {
      log.error("DELETE failed", { error });
      return errorResponse(error.message, 500);
    }

    await logBuilderAction(db, user.id, "delete", "assessment_component", componentId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    log.error("DELETE failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
