import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/share/[token]
 *
 * Access a shared resource via public token.
 * Returns the resource content (note or document metadata) if the token is valid.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Find the share link
    const { data: link } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", token)
      .eq("active", true)
      .single();

    if (!link) {
      return NextResponse.json({ error: "Link nicht gefunden oder abgelaufen" }, { status: 404 });
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: "Link abgelaufen" }, { status: 410 });
    }

    // Increment view count (fire-and-forget)
    supabase
      .from("share_links")
      .update({ view_count: (link.view_count ?? 0) + 1 })
      .eq("id", link.id)
      .then(() => {});

    // Fetch resource
    if (link.resource_type === "note") {
      const { data: note } = await supabase
        .from("notes")
        .select("id, title, content, color, status, updated_at")
        .eq("id", link.resource_id)
        .single();

      if (!note) return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });

      // Fetch owner info
      const { data: owner } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", link.owner_id)
        .single();

      return NextResponse.json({
        type: "note",
        resource: note,
        owner: owner ?? { username: "anonym" },
        permission: link.permission,
      });
    }

    if (link.resource_type === "document") {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, title, kind, url, file_type, file_size, color, updated_at")
        .eq("id", link.resource_id)
        .single();

      if (!doc) return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });

      const { data: owner } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", link.owner_id)
        .single();

      return NextResponse.json({
        type: "document",
        resource: doc,
        owner: owner ?? { username: "anonym" },
        permission: link.permission,
      });
    }

    return NextResponse.json({ error: "Unbekannter Typ" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
