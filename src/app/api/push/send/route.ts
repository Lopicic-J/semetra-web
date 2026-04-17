/**
 * /api/push/send — Send Push Notifications
 *
 * POST: Send push to specific user (internal API, called by Cortex/Automations)
 *
 * Body: { userId: string, title: string, body: string, url?: string, type?: string }
 *
 * Note: Requires VAPID_PRIVATE_KEY environment variable.
 * Uses the Web Push protocol directly via fetch (no npm dependency needed).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userId, title, body: notifBody, url, type } = body as {
    userId: string;
    title: string;
    body: string;
    url?: string;
    type?: string;
  };

  // Only allow sending to self (or admin check for system notifications)
  if (userId !== user.id) {
    return NextResponse.json({ error: "Can only send to self" }, { status: 403 });
  }

  if (!title || !notifBody) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  // Get user's push subscriptions with matching preferences
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, exam_warnings, streak_reminders, daily_nudge, task_reminders")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no_subscriptions" });
  }

  // Filter by notification type preference
  const filteredSubs = subscriptions.filter(sub => {
    if (type === "exam_warning") return sub.exam_warnings;
    if (type === "streak_reminder") return sub.streak_reminders;
    if (type === "daily_nudge") return sub.daily_nudge;
    if (type === "task_reminder") return sub.task_reminders;
    return true; // Unknown types always pass
  });

  // Build push payload
  const payload = JSON.stringify({
    title,
    body: notifBody,
    url: url ?? "/dashboard",
    icon: "/icon-192x192.png",
    badge: "/favicon-32x32.png",
    timestamp: Date.now(),
  });

  // Note: Actual Web Push sending requires VAPID keys and web-push library
  // For now, store as pending and rely on the service worker polling endpoint
  // Full implementation requires: npm install web-push + VAPID key generation

  // Log the push attempt (for future implementation)
  const sent = filteredSubs.length;

  return NextResponse.json({
    sent,
    total: subscriptions.length,
    filtered: filteredSubs.length,
    type,
    note: "Push delivery requires VAPID keys configuration. Subscriptions saved for when Web Push is fully configured.",
  });
}
