import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/friends/[id]
 * Accept, decline, or block a friend request.
 * Body: { action: "accept" | "decline" | "block" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { action } = await req.json();
    if (!["accept", "decline", "block"].includes(action)) {
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    }

    // Fetch the friendship
    const { data: friendship, error: fetchErr } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .eq("id", id)
      .single();

    if (fetchErr || !friendship) {
      return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
    }

    // Only the addressee can accept/decline; either party can block
    const isAddresse = friendship.addressee_id === user.id;
    const isRequester = friendship.requester_id === user.id;

    if (!isAddresse && !isRequester) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    if ((action === "accept" || action === "decline") && !isAddresse) {
      return NextResponse.json({ error: "Nur der Empfänger kann annehmen/ablehnen" }, { status: 403 });
    }

    const statusMap: Record<string, string> = {
      accept: "accepted",
      decline: "declined",
      block: "blocked",
    };

    const { error: updateErr } = await supabase
      .from("friendships")
      .update({ status: statusMap[action], updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) throw updateErr;

    const messages: Record<string, string> = {
      accept: "Freundschaftsanfrage angenommen!",
      decline: "Freundschaftsanfrage abgelehnt",
      block: "Benutzer blockiert",
    };

    return NextResponse.json({ message: messages[action], status: statusMap[action] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/friends/[id]
 * Remove a friendship (unfriend).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", id)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) throw error;

    return NextResponse.json({ message: "Freundschaft entfernt" });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
