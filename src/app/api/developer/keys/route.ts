import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

/**
 * GET /api/developer/keys
 *
 * List user's API keys (without the actual key value).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { data } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, rate_limit, last_used, expires_at, active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * POST /api/developer/keys
 *
 * Create a new API key. Returns the full key ONCE (not stored).
 * Body: { name, scopes?: string[], expiresInDays?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { name, scopes = ["read"], expiresInDays } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

    // Generate key: sk_live_ + 32 random hex chars
    const rawKey = `sk_live_${randomBytes(24).toString("hex")}`;
    const prefix = rawKey.slice(0, 8);
    const hash = createHash("sha256").update(rawKey).digest("hex");

    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }

    const { data: key, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        expires_at: expiresAt,
      })
      .select("id, name, key_prefix, scopes, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the full key — this is the ONLY time it's visible
    return NextResponse.json({ key: { ...key, fullKey: rawKey } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/keys
 *
 * Revoke an API key.
 * Body: { keyId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { keyId } = await req.json();
    const { error } = await supabase
      .from("api_keys")
      .update({ active: false })
      .eq("id", keyId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
