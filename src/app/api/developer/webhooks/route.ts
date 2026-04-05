import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

/**
 * GET /api/developer/webhooks
 *
 * List user's registered webhooks.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { data } = await supabase
      .from("webhooks")
      .select("id, url, events, secret_prefix, active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ webhooks: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developer/webhooks
 *
 * Create a new webhook.
 * Body: { url, events: string[] }
 * Returns: { webhook: { id, url, events, secret, secret_prefix } }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { url, events } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: "URL erforderlich" }, { status: 400 });
    if (!events?.length) return NextResponse.json({ error: "Mindestens ein Event erforderlich" }, { status: 400 });

    // Generate webhook secret
    const secret = `wh_${randomBytes(24).toString("hex")}`;
    const secretPrefix = secret.slice(0, 5);

    const { data: webhook, error } = await supabase
      .from("webhooks")
      .insert({
        user_id: user.id,
        url: url.trim(),
        events,
        secret,
        secret_prefix: secretPrefix,
        active: true,
      })
      .select("id, url, events, secret_prefix, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      webhook: {
        ...webhook,
        secret, // Return secret once
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Erstellen" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developer/webhooks
 *
 * Delete a webhook.
 * Body: { webhookId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { webhookId } = await req.json();
    const { error } = await supabase
      .from("webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Löschen" },
      { status: 500 }
    );
  }
}
