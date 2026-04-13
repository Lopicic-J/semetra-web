/**
 * /api/analytics/event — Lightweight event tracking endpoint
 *
 * Stores events in the analytics_events table.
 * Auth is optional — anonymous events are stored with user_id = null.
 * Non-blocking, fast — returns 204 immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  try {
    const body = await req.json();
    const { name, data } = body;

    if (!name || typeof name !== "string") {
      return new NextResponse(null, { status: 400 });
    }

    // Try to get user from auth header (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // Also try cookie-based auth
    if (!userId) {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const sbAccessToken = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("sb-") && c.includes("-auth-token"));
      if (sbAccessToken) {
        const token = sbAccessToken.split("=").slice(1).join("=");
        try {
          const parsed = JSON.parse(decodeURIComponent(token));
          const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
          if (accessToken) {
            const { data: { user } } = await supabase.auth.getUser(accessToken);
            userId = user?.id ?? null;
          }
        } catch {
          // Cookie parsing failed — that's fine, continue as anonymous
        }
      }
    }

    // Store event (non-blocking)
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: name,
      event_data: data ?? {},
      page_url: req.headers.get("referer") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
      created_at: new Date().toISOString(),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Never fail — analytics should not break anything
    return new NextResponse(null, { status: 204 });
  }
}
