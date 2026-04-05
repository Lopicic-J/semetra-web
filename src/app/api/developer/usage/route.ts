import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:developer");

/**
 * GET /api/developer/usage
 *
 * Returns API usage statistics for the authenticated user.
 * - daily: array of { date, count } for last 30 days
 * - total: total requests all time
 * - byKey: breakdown by API key
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    // Get usage by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyUsage } = await supabase
      .from("api_usage_log")
      .select("date, count(*)")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("date", { ascending: true });

    // Get total requests
    const { data: totalData } = await supabase
      .from("api_usage_log")
      .select("id")
      .eq("user_id", user.id);

    const total = totalData?.length ?? 0;

    // Get usage by key - fetch all entries and group client-side
    const { data: allByKeyData } = await supabase
      .from("api_usage_log")
      .select("key_id")
      .eq("user_id", user.id);

    const byKeyData = allByKeyData ? Object.entries(
      allByKeyData.reduce((acc: Record<string, number>, entry: any) => {
        acc[entry.key_id] = (acc[entry.key_id] || 0) + 1;
        return acc;
      }, {})
    ).map(([key_id, count]) => ({ key_id, count })) : [];

    // Fetch key names
    const { data: keys } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix")
      .eq("user_id", user.id);

    const keyMap = new Map(keys?.map(k => [k.id, { name: k.name, prefix: k.key_prefix }]) ?? []);

    const byKey = (byKeyData ?? []).map((entry: any) => ({
      key_id: entry.key_id,
      key_prefix: keyMap.get(entry.key_id)?.prefix ?? "unknown",
      name: keyMap.get(entry.key_id)?.name ?? "Unknown Key",
      count: entry.count ?? 0,
    }));

    return NextResponse.json({
      daily: (dailyUsage ?? []).map((d: any) => ({
        date: d.date,
        count: d.count ?? 0,
      })),
      total,
      byKey,
    });
  } catch (err: unknown) {
    log.error("[usage] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Laden" },
      { status: 500 }
    );
  }
}
