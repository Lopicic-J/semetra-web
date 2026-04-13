/**
 * /api/webhooks/outbound — Manage outbound webhook subscriptions
 *
 * GET:    List user's outbound webhooks
 * POST:   Create a new outbound webhook
 * PATCH:  Update webhook (toggle, events, URL)
 * DELETE: Remove a webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[] | null;
  active: boolean;
  created_at: string;
}

const ALLOWED_EVENTS = [
  "grade.created",
  "grade.updated",
  "task.completed",
  "task.created",
  "module.created",
  "exam.upcoming",
  "flashcard.reviewed",
  "timer.completed",
  "export.generated",
  "plugin.installed",
  "plugin.uninstalled",
];

const MAX_WEBHOOKS_PER_USER = 5;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: webhooksRaw } = await supabase
    .from("webhooks")
    .select("id, url, secret, events, active, created_at")
    .eq("user_id", user.id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false });

  const webhooks = (webhooksRaw ?? []) as WebhookRow[];

  // Mask secrets (show only last 4 chars)
  const masked = webhooks.map((w) => ({
    ...w,
    secret: w.secret ? `••••${w.secret.slice(-4)}` : "••••",
  }));

  return NextResponse.json({ webhooks: masked, allowedEvents: ALLOWED_EVENTS });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, events } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only HTTP(S) URLs allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Validate events
  const selectedEvents = Array.isArray(events) ? events.filter((e: string) => ALLOWED_EVENTS.includes(e)) : [];

  // Check limit
  const { count } = await supabase
    .from("webhooks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("direction", "outbound");

  if ((count ?? 0) >= MAX_WEBHOOKS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_WEBHOOKS_PER_USER} webhooks allowed` },
      { status: 400 }
    );
  }

  // Generate signing secret
  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const { data: webhook, error } = await supabase
    .from("webhooks")
    .insert({
      user_id: user.id,
      direction: "outbound",
      url,
      secret,
      events: selectedEvents.length > 0 ? selectedEvents : null,
      active: true,
    })
    .select("id, url, events, active, created_at")
    .single();

  if (error) {
    console.error("[webhook-outbound] Create error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }

  // Return secret only on creation (user must save it)
  return NextResponse.json({ webhook: { ...webhook, secret } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, url, events, active } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (url !== undefined) updates.url = url;
  if (events !== undefined) {
    updates.events = Array.isArray(events)
      ? events.filter((e: string) => ALLOWED_EVENTS.includes(e))
      : null;
  }
  if (active !== undefined) updates.active = Boolean(active);

  const { error } = await supabase
    .from("webhooks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[webhook-outbound] Update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[webhook-outbound] Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
