import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:module-publish");

/**
 * POST /api/academic/modules/[id]/publish
 *
 * Validate and publish a module.
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Verify module exists
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("id, name, module_code")
      .eq("id", id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { error: "Modul nicht gefunden" },
        { status: 404 }
      );
    }

    // Call the publish_module RPC function
    const { data: publishResult, error: publishError } = await supabase.rpc(
      "publish_module",
      {
        p_module_id: id,
      }
    );

    if (publishError) {
      log.error("POST publish RPC failed", { error: publishError });
      // Check if it's a validation error
      if (publishError.message.includes("validation") || publishError.message.includes("invalid")) {
        return NextResponse.json(
          { error: publishError.message, details: publishResult },
          { status: 422 }
        );
      }
      return NextResponse.json({ error: publishError.message }, { status: 500 });
    }

    // Fetch updated module to return
    const { data: updatedModule, error: fetchError } = await supabase
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      log.error("POST fetch updated module failed", { error: fetchError });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Modul erfolgreich veröffentlicht",
      module: updatedModule,
      publishResult,
    });
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
