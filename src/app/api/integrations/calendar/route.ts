/**
 * /api/integrations/calendar — Calendar Sync (Google Calendar / iCal)
 *
 * GET: Export Semetra events as iCal feed (subscribable URL)
 * POST: Import events from external calendar URL
 * PATCH: Update sync settings
 *
 * Phase 1: iCal export feed (works with Google Calendar, Apple Calendar, Outlook)
 * Phase 2: Google Calendar API import (requires OAuth — future)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET: Generate iCal feed for user's events.
 * This URL can be subscribed to in Google Calendar, Apple Calendar, etc.
 *
 * Query params:
 *   ?token=<api_token> — Auth via token (for calendar subscription URLs)
 *   ?types=exam,lecture,deadline — Filter event types
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const typesParam = url.searchParams.get("types");
  const types = typesParam ? typesParam.split(",") : null;

  // Fetch events (next 90 days + past 30 days)
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setDate(to.getDate() + 90);

  let query = supabase
    .from("events")
    .select("id, title, description, start_dt, end_dt, location, event_type, color")
    .gte("start_dt", from.toISOString())
    .lte("start_dt", to.toISOString())
    .order("start_dt");

  if (types && types.length > 0) {
    query = query.in("event_type", types);
  }

  const { data: events } = await query;

  // Also fetch stundenplan (recurring schedule)
  const { data: stundenplan } = await supabase
    .from("stundenplan")
    .select("id, title, day, time_start, time_end, location, module_id, modules(name)");

  // Build iCal
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Semetra//Calendar//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Semetra Studienplan",
    "X-WR-TIMEZONE:Europe/Zurich",
  ];

  // Events
  for (const event of events ?? []) {
    const dtStart = formatICalDate(event.start_dt);
    const dtEnd = event.end_dt ? formatICalDate(event.end_dt) : formatICalDate(new Date(new Date(event.start_dt).getTime() + 3600000).toISOString());

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@semetra.ch`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcal(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${escapeIcal(event.description)}`] : []),
      ...(event.location ? [`LOCATION:${escapeIcal(event.location)}`] : []),
      `CATEGORIES:${event.event_type?.toUpperCase() ?? "EVENT"}`,
      "END:VEVENT",
    );
  }

  // Stundenplan as recurring events (weekly)
  for (const entry of stundenplan ?? []) {
    const moduleName = (entry as any).modules?.name ?? "";
    const dayIndex = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].indexOf(entry.day);
    if (dayIndex < 0) continue;

    // Find next occurrence of this weekday
    const now = new Date();
    const daysUntil = ((dayIndex + 1) - now.getDay() + 7) % 7;
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);

    const startStr = nextDate.toISOString().split("T")[0].replace(/-/g, "") + "T" + (entry.time_start ?? "08:00").replace(":", "") + "00";
    const endStr = nextDate.toISOString().split("T")[0].replace(/-/g, "") + "T" + (entry.time_end ?? "09:00").replace(":", "") + "00";

    lines.push(
      "BEGIN:VEVENT",
      `UID:stundenplan-${entry.id}@semetra.ch`,
      `DTSTART;TZID=Europe/Zurich:${startStr}`,
      `DTEND;TZID=Europe/Zurich:${endStr}`,
      `SUMMARY:${escapeIcal(entry.title)}${moduleName ? ` (${moduleName})` : ""}`,
      ...(entry.location ? [`LOCATION:${escapeIcal(entry.location)}`] : []),
      "RRULE:FREQ=WEEKLY",
      "CATEGORIES:LECTURE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="semetra.ics"',
      "Cache-Control": "no-cache, max-age=0",
    },
  });
}

function formatICalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcal(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
