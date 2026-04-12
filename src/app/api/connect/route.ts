import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helper: fetch profiles by IDs ─────────────────────────────────────────
async function fetchProfiles(supabase: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, institution_id, current_semester, level, online_status, connect_bio, country")
    .in("id", ids);
  const map = new Map<string, any>();
  for (const p of data ?? []) map.set(p.id, p);
  return map;
}

/**
 * GET /api/connect?tab=discover|requests|connections&search=...&limit=20&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const tab = req.nextUrl.searchParams.get("tab") || "discover";
    const search = req.nextUrl.searchParams.get("search") || undefined;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    if (tab === "discover") {
      const { data, error } = await supabase.rpc("discover_connect_students", {
        p_limit: limit,
        p_offset: offset,
        p_search: search ?? null,
      });
      if (error) throw error;

      const { data: counts } = await supabase.rpc("get_connect_counts");

      return NextResponse.json({
        students: data ?? [],
        counts: counts?.[0] ?? { total_connections: 0, pending_received: 0, pending_sent: 0 },
      });
    }

    if (tab === "requests") {
      // Fetch raw incoming pending connections
      const { data: incomingRaw, error } = await supabase
        .from("student_connections")
        .select("id, requester_id, addressee_id, status, message, program_match, created_at")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;

      // Fetch raw sent pending connections
      const { data: sentRaw, error: sentErr } = await supabase
        .from("student_connections")
        .select("id, requester_id, addressee_id, status, message, program_match, created_at")
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (sentErr) throw sentErr;

      // Collect all user IDs we need profiles for
      const profileIds = new Set<string>();
      for (const r of incomingRaw ?? []) profileIds.add(r.requester_id);
      for (const r of sentRaw ?? []) profileIds.add(r.addressee_id);

      const profiles = await fetchProfiles(supabase, [...profileIds]);

      // Enrich with profile data
      const incoming = (incomingRaw ?? []).map((r: any) => ({
        id: r.id,
        requester_id: r.requester_id,
        addressee_id: r.addressee_id,
        status: r.status,
        message: r.message,
        program_match: r.program_match,
        created_at: r.created_at,
        requester: profiles.get(r.requester_id) ?? null,
      }));

      const sent = (sentRaw ?? []).map((r: any) => ({
        id: r.id,
        requester_id: r.requester_id,
        addressee_id: r.addressee_id,
        status: r.status,
        message: r.message,
        program_match: r.program_match,
        created_at: r.created_at,
        addressee: profiles.get(r.addressee_id) ?? null,
      }));

      const { data: counts } = await supabase.rpc("get_connect_counts");

      return NextResponse.json({
        incoming,
        sent,
        counts: counts?.[0] ?? { total_connections: 0, pending_received: 0, pending_sent: 0 },
      });
    }

    if (tab === "connections") {
      // Fetch raw accepted connections
      const { data: raw, error } = await supabase
        .from("student_connections")
        .select("id, requester_id, addressee_id, status, program_match, created_at, updated_at")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;

      // Collect peer IDs
      const peerIds = (raw ?? []).map((c: any) =>
        c.requester_id === user.id ? c.addressee_id : c.requester_id
      );
      const profiles = await fetchProfiles(supabase, peerIds);

      const connections = (raw ?? []).map((c: any) => {
        const peerId = c.requester_id === user.id ? c.addressee_id : c.requester_id;
        return {
          id: c.id,
          program_match: c.program_match,
          connected_at: c.updated_at,
          peer: profiles.get(peerId) ?? null,
        };
      });

      const { data: counts } = await supabase.rpc("get_connect_counts");

      return NextResponse.json({
        connections,
        counts: counts?.[0] ?? { total_connections: 0, pending_received: 0, pending_sent: 0 },
      });
    }

    return NextResponse.json({ error: "Ungültiger Tab" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/connect
 * Send a connection request.
 * Body: { targetId: string, message?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    const { targetId, message } = body;

    if (!targetId) {
      return NextResponse.json({ error: "targetId erforderlich" }, { status: 400 });
    }
    if (targetId === user.id) {
      return NextResponse.json({ error: "Du kannst dich nicht selbst verbinden" }, { status: 400 });
    }

    // Check target is contactable
    const { data: target } = await supabase
      .from("profiles")
      .select("id, connect_contactable, active_program_id")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    if (!target.connect_contactable) {
      return NextResponse.json({ error: "Dieser Benutzer nimmt keine Verbindungsanfragen an" }, { status: 403 });
    }

    // Check if connection already exists
    const { data: existing } = await supabase
      .from("student_connections")
      .select("id, status, requester_id")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "Ihr seid bereits verbunden" }, { status: 409 });
      }
      if (existing.status === "pending") {
        if (existing.requester_id === targetId) {
          const { error: upErr } = await supabase
            .from("student_connections")
            .update({ status: "accepted" })
            .eq("id", existing.id);
          if (upErr) throw upErr;
          return NextResponse.json({ message: "Verbindung hergestellt!", status: "accepted" });
        }
        return NextResponse.json({ error: "Anfrage bereits gesendet" }, { status: 409 });
      }
      if (existing.status === "blocked") {
        return NextResponse.json({ error: "Aktion nicht möglich" }, { status: 403 });
      }
      if (existing.status === "declined") {
        const { error: upErr } = await supabase
          .from("student_connections")
          .update({ status: "pending", requester_id: user.id, addressee_id: targetId, message: message || "" })
          .eq("id", existing.id);
        if (upErr) throw upErr;
        return NextResponse.json({ message: "Anfrage erneut gesendet" });
      }
    }

    // Get shared program name
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("active_program_id")
      .eq("id", user.id)
      .single();

    let programMatch: string | null = null;
    if (myProfile?.active_program_id) {
      const { data: prog } = await supabase
        .from("programs")
        .select("name")
        .eq("id", myProfile.active_program_id)
        .single();
      programMatch = prog?.name ?? null;
    }

    const { data: conn, error } = await supabase
      .from("student_connections")
      .insert({
        requester_id: user.id,
        addressee_id: targetId,
        status: "pending",
        message: message || "",
        program_match: programMatch,
      })
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ connection: conn, message: "Verbindungsanfrage gesendet" }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * PATCH /api/connect
 * Accept, decline, or block a connection request.
 * Body: { connectionId: string, action: "accept" | "decline" | "block" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { connectionId, action } = await req.json();

    if (!connectionId || !["accept", "decline", "block"].includes(action)) {
      return NextResponse.json({ error: "connectionId und action (accept|decline|block) erforderlich" }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      accept: "accepted",
      decline: "declined",
      block: "blocked",
    };

    const { error } = await supabase
      .from("student_connections")
      .update({ status: statusMap[action] })
      .eq("id", connectionId);

    if (error) throw error;

    return NextResponse.json({ message: `Verbindung ${action === "accept" ? "angenommen" : action === "decline" ? "abgelehnt" : "blockiert"}` });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/connect
 * Remove a connection.
 * Body: { connectionId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { connectionId } = await req.json();
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId erforderlich" }, { status: 400 });
    }

    const { error } = await supabase
      .from("student_connections")
      .delete()
      .eq("id", connectionId);

    if (error) throw error;

    return NextResponse.json({ message: "Verbindung entfernt" });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
