/**
 * /api/push/subscribe — Push Notification Subscription Management
 *
 * POST: Save/update push subscription
 * DELETE: Remove push subscription
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { endpoint, p256dh, auth, preferences } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "endpoint, p256dh, auth required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth_key: auth,
      exam_warnings: preferences?.examWarnings ?? true,
      streak_reminders: preferences?.streakReminders ?? true,
      daily_nudge: preferences?.dailyNudge ?? true,
      task_reminders: preferences?.taskReminders ?? false,
      user_agent: request.headers.get("user-agent") ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,endpoint",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ unsubscribed: true });
}
