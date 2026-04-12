import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  requireRole,
  logBuilderAction,
  errorResponse,
  isErrorResponse,
  createServiceClient,
} from "@/lib/api-helpers";

const log = logger("api:module-publish");

/**
 * POST /api/academic/modules/[id]/publish
 *
 * Validate and publish a module.
 * Admin only (admin or institution)
 * Calls RPC function: publish_module(p_module_id uuid)
 *
 * Returns validation result and published module data.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user } = rc;
    const db = rc.adminClient ?? createServiceClient();

    // Verify module exists
    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, name, module_code")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Call the publish_module RPC function
    const { data: publishResult, error: publishError } = await db.rpc(
      "publish_module",
      {
        p_module_id: id,
      }
    );

    if (publishError) {
      log.error("POST publish RPC failed", { error: publishError });
      return errorResponse(publishError.message, 500);
    }

    // RPC returns { success: false, errors: [...] } if validation fails
    if (publishResult && publishResult.success === false) {
      const errors = publishResult.errors || [];
      const errorMessages = Array.isArray(errors)
        ? errors.map((e: unknown) => (typeof e === "string" ? e : JSON.stringify(e))).join("; ")
        : "Validierungsfehler";
      return NextResponse.json(
        { error: `Validierung fehlgeschlagen: ${errorMessages}`, details: publishResult },
        { status: 422 }
      );
    }

    // Fetch updated module to return
    const { data: updatedModule, error: fetchError } = await db
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      log.error("POST fetch updated module failed", { error: fetchError });
      return errorResponse(fetchError.message, 500);
    }

    await logBuilderAction(db, user.id, "update", "module", id, module.name, { published: true });

    return NextResponse.json({
      message: "Modul erfolgreich veröffentlicht",
      module: updatedModule,
      publishResult,
    });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
