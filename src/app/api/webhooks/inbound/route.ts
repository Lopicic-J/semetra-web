/**
 * /api/webhooks/inbound — Receive external webhooks
 *
 * Validates HMAC signature, then dispatches the event to the appropriate handler.
 * Each user registers their inbound webhook endpoints in settings.
 *
 * Supported events:
 *   - lms.grade_sync    (Moodle/ILIAS → Semetra grade import)
 *   - calendar.event    (External calendar → Semetra event)
 *   - custom.data       (Generic data push from external services)
 *
 * Headers required:
 *   X-Semetra-Signature: sha256=<hmac hex>
 *   X-Semetra-User-Id:   <user uuid>
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifySignature } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-semetra-signature");
    const userId = req.headers.get("x-semetra-user-id");
    const event = req.headers.get("x-semetra-event") || "custom.data";

    if (!signature || !userId) {
      return NextResponse.json(
        { error: "Missing X-Semetra-Signature or X-Semetra-User-Id header" },
        { status: 401 }
      );
    }

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Look up user's inbound webhook secret
    const supabase = await createClient();
    const { data: webhook } = await supabase
      .from("webhooks")
      .select("id, secret, active, events")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .single();

    if (!webhook) {
      return NextResponse.json({ error: "No active webhook found for user" }, { status: 404 });
    }

    // Verify HMAC signature
    const isValid = verifySignature(rawBody, signature, webhook.secret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Log the inbound event
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      direction: "inbound",
      event,
      payload,
      status: "received",
      received_at: new Date().toISOString(),
    });

    // Dispatch based on event type
    switch (event) {
      case "lms.grade_sync": {
        const grades = (payload.grades ?? []) as Array<{
          module_code?: string;
          grade?: number;
          title?: string;
        }>;
        if (grades.length > 0) {
          // Match grades to modules by code
          for (const g of grades) {
            if (!g.module_code || g.grade == null) continue;
            const { data: mod } = await supabase
              .from("modules")
              .select("id")
              .eq("user_id", userId)
              .eq("code", g.module_code)
              .single();

            if (mod) {
              await supabase.from("grades").insert({
                user_id: userId,
                module_id: mod.id,
                title: g.title || `Import: ${g.module_code}`,
                grade: g.grade,
                weight: 1,
                source: "webhook",
              });
            }
          }
        }
        break;
      }

      case "calendar.event": {
        const events = (payload.events ?? []) as Array<{
          title?: string;
          start_dt?: string;
          end_dt?: string;
          description?: string;
          color?: string;
        }>;
        for (const ev of events) {
          if (!ev.title || !ev.start_dt) continue;
          await supabase.from("events").insert({
            user_id: userId,
            title: ev.title,
            start_dt: ev.start_dt,
            end_dt: ev.end_dt || ev.start_dt,
            description: ev.description || null,
            color: ev.color || "#6d28d9",
          });
        }
        break;
      }

      default:
        // Generic: just log it (already logged above)
        break;
    }

    return NextResponse.json({ ok: true, event });
  } catch (err) {
    console.error("[webhook-inbound] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
