import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sharing/link
 *
 * Create a public share link for a note or document.
 * Body: { resourceType: "note"|"document", resourceId, permission?, expiresInDays? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { resourceType, resourceId, permission = "viewer", expiresInDays } = await req.json();

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "resourceType und resourceId erforderlich" }, { status: 400 });
    }

    // Verify ownership
    const table = resourceType === "note" ? "notes" : "documents";
    const { data: resource } = await supabase
      .from(table)
      .select("id")
      .eq("id", resourceId)
      .eq("user_id", user.id)
      .single();

    if (!resource) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Calculate expiry
    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }

    const { data: link, error } = await supabase
      .from("share_links")
      .insert({
        owner_id: user.id,
        resource_type: resourceType,
        resource_id: resourceId,
        permission,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ link });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/sharing/link
 *
 * Deactivate a share link.
 * Body: { linkId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { linkId } = await req.json();

    const { error } = await supabase
      .from("share_links")
      .update({ active: false })
      .eq("id", linkId)
      .eq("owner_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
