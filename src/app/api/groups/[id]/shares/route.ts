import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["note", "document", "module", "exam", "flashcards"] as const;
type ResourceType = (typeof ALLOWED_TYPES)[number];

/**
 * GET /api/groups/[id]/shares
 *
 * List all shared resources in a group (with resource names resolved).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Verify membership
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });

    const { data: shares } = await supabase
      .from("group_shares")
      .select("*, profiles!shared_by(username, full_name)")
      .eq("group_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ shares: shares ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/groups/[id]/shares
 *
 * Share a resource (module, exam, note, document, flashcard_deck) with the group.
 * Body: { resourceType, resourceId, resourceName? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Verify membership
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });

    const { resourceType, resourceId, resourceName } = await req.json();

    if (!ALLOWED_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: `Ungültiger Typ. Erlaubt: ${ALLOWED_TYPES.join(", ")}` }, { status: 400 });
    }
    if (!resourceId) {
      return NextResponse.json({ error: "Resource-ID erforderlich" }, { status: 400 });
    }

    // Resolve resource name if not provided
    let resolvedName = resourceName || "";
    if (!resolvedName) {
      const tableMap: Record<ResourceType, { table: string; nameCol: string }> = {
        module: { table: "modules", nameCol: "name" },
        exam: { table: "events", nameCol: "title" },
        note: { table: "notes", nameCol: "title" },
        document: { table: "documents", nameCol: "name" },
        flashcards: { table: "flashcards", nameCol: "question" },
      };
      const mapping = tableMap[resourceType as ResourceType];
      if (mapping) {
        const { data: resource } = await supabase
          .from(mapping.table)
          .select(mapping.nameCol)
          .eq("id", resourceId)
          .single();
        if (resource) {
          resolvedName = (resource as unknown as Record<string, string>)[mapping.nameCol] || "";
        }
      }
    }

    const { data: share, error } = await supabase
      .from("group_shares")
      .insert({
        group_id: id,
        resource_type: resourceType,
        resource_id: resourceId,
        shared_by: user.id,
        resource_name: resolvedName || null,
      })
      .select("*, profiles!shared_by(username, full_name)")
      .single();

    if (error) {
      // UNIQUE violation = already shared
      if (error.code === "23505") {
        return NextResponse.json({ error: "Diese Ressource wurde bereits geteilt" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ share });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/groups/[id]/shares
 *
 * Remove a shared resource from the group.
 * Body: { shareId }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { shareId } = await req.json();
    if (!shareId) return NextResponse.json({ error: "Share-ID erforderlich" }, { status: 400 });

    // Only the sharer or admin/owner can remove
    const { data: membership } = await supabase
      .from("study_group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });

    const isAdmin = ["owner", "admin"].includes(membership.role);

    // Build delete query
    let query = supabase
      .from("group_shares")
      .delete()
      .eq("id", shareId)
      .eq("group_id", id);

    // Non-admins can only remove their own shares
    if (!isAdmin) {
      query = query.eq("shared_by", user.id);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
