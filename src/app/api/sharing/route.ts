import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sharing
 *
 * Share a note or document with another user.
 * Body: { resourceType: "note"|"document", resourceId, username, permission?: "viewer"|"editor" }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { resourceType, resourceId, username, permission = "viewer" } = await req.json();

    if (!resourceType || !resourceId || !username) {
      return NextResponse.json({ error: "resourceType, resourceId und username sind erforderlich" }, { status: 400 });
    }
    if (!["note", "document"].includes(resourceType)) {
      return NextResponse.json({ error: "Ungültiger resourceType" }, { status: 400 });
    }

    // Look up recipient by username
    const { data: recipient } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username.toLowerCase())
      .single();

    if (!recipient) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    if (recipient.id === user.id) {
      return NextResponse.json({ error: "Kannst nicht mit dir selbst teilen" }, { status: 400 });
    }

    // Verify ownership
    const table = resourceType === "note" ? "notes" : "documents";
    const { data: resource } = await supabase
      .from(table)
      .select("id, user_id")
      .eq("id", resourceId)
      .eq("user_id", user.id)
      .single();

    if (!resource) {
      return NextResponse.json({ error: "Ressource nicht gefunden" }, { status: 404 });
    }

    // Create share
    const shareTable = resourceType === "note" ? "note_shares" : "document_shares";
    const fkCol = resourceType === "note" ? "note_id" : "document_id";

    const { data: share, error } = await supabase
      .from(shareTable)
      .upsert({
        [fkCol]: resourceId,
        owner_id: user.id,
        shared_with: recipient.id,
        permission,
      }, { onConflict: `${fkCol},shared_with` })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ share });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * GET /api/sharing?resourceType=note&resourceId=xxx
 *
 * List all shares for a resource.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get("resourceType");
    const resourceId = searchParams.get("resourceId");

    if (!resourceType || !resourceId) {
      // Return all items shared WITH the current user
      const [noteShares, docShares] = await Promise.all([
        supabase.from("note_shares").select("*, notes(id, title, content, color, updated_at)").eq("shared_with", user.id),
        supabase.from("document_shares").select("*, documents(id, title, kind, url, file_type, color, updated_at)").eq("shared_with", user.id),
      ]);
      return NextResponse.json({
        sharedNotes: noteShares.data ?? [],
        sharedDocuments: docShares.data ?? [],
      });
    }

    // Return shares for a specific resource (owner view)
    const shareTable = resourceType === "note" ? "note_shares" : "document_shares";
    const fkCol = resourceType === "note" ? "note_id" : "document_id";

    const { data: shares } = await supabase
      .from(shareTable)
      .select("*, profiles!shared_with(username, full_name, avatar_url)")
      .eq(fkCol, resourceId)
      .eq("owner_id", user.id);

    return NextResponse.json({ shares: shares ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/sharing
 *
 * Remove a share.
 * Body: { shareId, resourceType }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { shareId, resourceType } = await req.json();
    const shareTable = resourceType === "note" ? "note_shares" : "document_shares";

    const { error } = await supabase
      .from(shareTable)
      .delete()
      .eq("id", shareId)
      .eq("owner_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
