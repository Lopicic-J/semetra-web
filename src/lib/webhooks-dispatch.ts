/**
 * Webhook Dispatch System — Outbound Event Broadcasting
 *
 * When key events happen in Semetra (grade created, task completed, etc.),
 * this module fires outbound webhooks to all matching user subscriptions.
 *
 * Usage:
 *   import { dispatchWebhook } from "@/lib/webhooks-dispatch";
 *   await dispatchWebhook(userId, "grade.created", { grade: 5.5, module: "CS101" });
 */

import { createClient } from "@/lib/supabase/server";
import { deliverWebhook } from "@/lib/webhooks";

/** All supported outbound event types */
export type WebhookEvent =
  | "grade.created"
  | "grade.updated"
  | "task.completed"
  | "task.created"
  | "module.created"
  | "exam.upcoming"
  | "flashcard.reviewed"
  | "timer.completed"
  | "export.generated"
  | "plugin.installed"
  | "plugin.uninstalled";

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[] | null;
}

interface DeliveryResult {
  webhookId: string;
  success: boolean;
  statusCode: number | null;
  error: string | null;
  duration: number;
  attempt: number;
}

/**
 * Fire outbound webhooks for a user event.
 *
 * Finds all active outbound webhooks for the user that subscribe to
 * the given event, delivers the payload with HMAC signing, and logs
 * the result in webhook_deliveries.
 *
 * Runs fire-and-forget — callers should NOT await this in the
 * critical path unless delivery confirmation is needed.
 */
export async function dispatchWebhook(
  userId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<DeliveryResult[]> {
  try {
    const supabase = await createClient();

    // Get all active outbound webhooks for this user
    const { data: webhooksRaw } = await supabase
      .from("webhooks")
      .select("id, url, secret, events")
      .eq("user_id", userId)
      .eq("direction", "outbound")
      .eq("active", true);

    const webhooks = (webhooksRaw ?? []) as WebhookRow[];
    if (webhooks.length === 0) return [];

    // Filter to webhooks that subscribe to this event
    const matching = webhooks.filter((w) => {
      if (!w.events || w.events.length === 0) return true; // No filter = all events
      return w.events.includes(event);
    });

    if (matching.length === 0) return [];

    // Deliver in parallel
    const results = await Promise.allSettled(
      matching.map(async (webhook): Promise<DeliveryResult> => {
        const result = await deliverWebhook(webhook.url, event, payload, webhook.secret);

        // Log delivery
        await supabase.from("webhook_deliveries").insert({
          webhook_id: webhook.id,
          direction: "outbound",
          event,
          payload,
          status: result.success ? "delivered" : "failed",
          status_code: result.statusCode,
          error_message: result.error,
          duration_ms: result.duration,
          attempts: result.attempt,
          delivered_at: result.success ? new Date().toISOString() : null,
        });

        return {
          webhookId: webhook.id,
          ...result,
        };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<DeliveryResult> => r.status === "fulfilled")
      .map((r) => r.value);
  } catch (err) {
    console.error("[webhook-dispatch] Error:", err);
    return [];
  }
}

/**
 * Fire-and-forget wrapper — use this in API routes where you don't
 * want to block the response on webhook delivery.
 */
export function dispatchWebhookAsync(
  userId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): void {
  dispatchWebhook(userId, event, payload).catch((err) => {
    console.error("[webhook-dispatch-async] Unhandled:", err);
  });
}
