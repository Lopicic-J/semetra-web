import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

/**
 * Authenticate a public API request via Bearer token.
 *
 * Checks:
 *   1. Bearer token present
 *   2. Key exists, is active, not expired
 *   3. Rate limit not exceeded
 *   4. Required scope is granted
 *
 * Returns { userId, keyId } on success, or an error response.
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScope: string = "read"
): Promise<
  | { ok: true; userId: string; keyId: string }
  | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }

  const token = auth.slice(7);
  const prefix = token.slice(0, 8);
  const hash = createHash("sha256").update(token).digest("hex");

  const supabase = await createClient();

  // Find key by prefix and verify hash
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, key_hash, scopes, rate_limit, expires_at, active")
    .eq("key_prefix", prefix)
    .eq("active", true)
    .single();

  if (!key || key.key_hash !== hash) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { ok: false, status: 401, error: "API key expired" };
  }

  // Check scope
  if (!key.scopes.includes(requiredScope) && !key.scopes.includes("*")) {
    return { ok: false, status: 403, error: `Missing scope: ${requiredScope}` };
  }

  // Rate limit check
  const { data: rateCheck } = await supabase.rpc("check_api_rate_limit", {
    p_key_prefix: prefix,
  });

  const limit = rateCheck?.[0] ?? rateCheck;
  if (limit && !limit.allowed) {
    return { ok: false, status: 429, error: "Rate limit exceeded" };
  }

  // Log usage (fire-and-forget)
  supabase
    .from("api_usage_log")
    .insert({
      api_key_id: key.id,
      endpoint: new URL(req.url).pathname,
      method: req.method,
      status_code: 200,
    })
    .then(() => {});

  return { ok: true, userId: key.user_id, keyId: key.id };
}
