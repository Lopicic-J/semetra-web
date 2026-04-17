/**
 * /api/plugins/moodle-sync/auto-import — Moodle Auto-Import
 *
 * POST: Auto-import Moodle data into Semetra:
 *   action: "grades" — Import grades from Moodle gradebook → Semetra grades table
 *   action: "assignments" — Import Moodle assignments → Semetra tasks
 *   action: "deadlines" — Import Moodle deadlines → Semetra events
 *   action: "all" — Import everything
 *
 * Requires active Moodle connection (via moodle-sync plugin).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action = "all" } = body as { action?: "grades" | "assignments" | "deadlines" | "all" };

  // Check plugin connection
  const { data: pluginData } = await supabase
    .from("user_plugins")
    .select("config")
    .eq("user_id", user.id)
    .eq("plugin_id", "moodle-sync")
    .single();

  const config = (pluginData?.config ?? {}) as {
    moodle_url?: string;
    token?: string;
    synced_courses?: { moodleId: number; semetraModuleId?: string }[];
  };

  if (!config.moodle_url || !config.token) {
    return NextResponse.json({ error: "Moodle nicht verbunden" }, { status: 400 });
  }

  const syncedCourses = config.synced_courses ?? [];
  if (syncedCourses.length === 0) {
    return NextResponse.json({ error: "Keine synchronisierten Kurse" }, { status: 400 });
  }

  const results = {
    grades: { imported: 0, skipped: 0, errors: 0 },
    assignments: { imported: 0, skipped: 0, errors: 0 },
    deadlines: { imported: 0, skipped: 0, errors: 0 },
  };

  const moodleApi = async (wsfunction: string, params: Record<string, string | number> = {}) => {
    const urlParams = new URLSearchParams({
      wstoken: config.token!,
      wsfunction,
      moodlewsrestformat: "json",
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    const res = await fetch(`${config.moodle_url}/webservice/rest/server.php?${urlParams}`);
    if (!res.ok) throw new Error(`Moodle API error: ${res.status}`);
    return res.json();
  };

  for (const course of syncedCourses) {
    if (!course.semetraModuleId) continue;

    try {
      // ── Import Grades ──
      if (action === "grades" || action === "all") {
        try {
          const gradeData = await moodleApi("gradereport_user_get_grade_items", {
            courseid: course.moodleId,
          });

          const gradeItems = gradeData?.usergrades?.[0]?.gradeitems ?? [];
          for (const item of gradeItems) {
            if (item.graderaw == null || item.itemtype === "course") continue;

            // Check if grade already exists (by title match)
            const { data: existing } = await supabase
              .from("grades")
              .select("id")
              .eq("module_id", course.semetraModuleId)
              .eq("title", item.itemname ?? "Moodle Grade")
              .limit(1)
              .maybeSingle();

            if (existing) {
              results.grades.skipped++;
              continue;
            }

            // Convert Moodle percentage (0-100) to Swiss grade (1-6)
            const percentage = item.percentageformatted ? parseFloat(item.percentageformatted) : (item.graderaw / (item.grademax || 100)) * 100;
            const swissGrade = Math.round((percentage / 100 * 5 + 1) * 10) / 10; // 0%→1.0, 100%→6.0

            await supabase.from("grades").insert({
              user_id: user.id,
              module_id: course.semetraModuleId,
              title: item.itemname ?? "Moodle Import",
              grade: Math.max(1, Math.min(6, swissGrade)),
              weight: item.weightraw ?? 1,
              date: new Date().toISOString().split("T")[0],
              notes: `Importiert aus Moodle (${item.percentageformatted ?? Math.round(percentage)}%)`,
            });
            results.grades.imported++;
          }
        } catch (err) {
          results.grades.errors++;
        }
      }

      // ── Import Assignments ──
      if (action === "assignments" || action === "all") {
        try {
          const assignData = await moodleApi("mod_assign_get_assignments", {
            courseids: `[${course.moodleId}]`,
          });

          const assignments = assignData?.courses?.[0]?.assignments ?? [];
          for (const assign of assignments) {
            // Check if task already exists
            const { data: existing } = await supabase
              .from("tasks")
              .select("id")
              .eq("module_id", course.semetraModuleId)
              .eq("title", assign.name)
              .limit(1)
              .maybeSingle();

            if (existing) {
              results.assignments.skipped++;
              continue;
            }

            const dueDate = assign.duedate ? new Date(assign.duedate * 1000).toISOString() : null;

            await supabase.from("tasks").insert({
              user_id: user.id,
              module_id: course.semetraModuleId,
              title: assign.name,
              description: assign.intro ? stripHtml(assign.intro).slice(0, 500) : null,
              due_date: dueDate,
              priority: dueDate && new Date(dueDate) < new Date(Date.now() + 3 * 86400000) ? "high" : "medium",
              status: "todo",
            });
            results.assignments.imported++;
          }
        } catch (err) {
          results.assignments.errors++;
        }
      }

      // ── Import Deadlines ──
      if (action === "deadlines" || action === "all") {
        try {
          const now = Math.floor(Date.now() / 1000);
          const in90Days = now + 90 * 86400;

          const eventData = await moodleApi("core_calendar_get_calendar_events", {
            "events[courseids][0]": course.moodleId,
            "options[timestart]": now,
            "options[timeend]": in90Days,
          });

          const events = eventData?.events ?? [];
          for (const evt of events) {
            const { data: existing } = await supabase
              .from("events")
              .select("id")
              .eq("title", evt.name)
              .eq("start_dt", new Date(evt.timestart * 1000).toISOString())
              .limit(1)
              .maybeSingle();

            if (existing) {
              results.deadlines.skipped++;
              continue;
            }

            await supabase.from("events").insert({
              user_id: user.id,
              module_id: course.semetraModuleId,
              title: evt.name,
              description: evt.description ? stripHtml(evt.description).slice(0, 500) : null,
              start_dt: new Date(evt.timestart * 1000).toISOString(),
              end_dt: evt.timeduration ? new Date((evt.timestart + evt.timeduration) * 1000).toISOString() : null,
              event_type: evt.eventtype === "due" ? "deadline" : "general",
            });
            results.deadlines.imported++;
          }
        } catch (err) {
          results.deadlines.errors++;
        }
      }
    } catch (err) {
      console.error(`[moodle-import] Course ${course.moodleId} failed:`, err);
    }
  }

  // Update last sync timestamp
  await supabase
    .from("user_plugins")
    .update({
      config: { ...config, last_sync: Date.now() },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("plugin_id", "moodle-sync");

  return NextResponse.json({
    success: true,
    results,
    totalImported: results.grades.imported + results.assignments.imported + results.deadlines.imported,
    totalSkipped: results.grades.skipped + results.assignments.skipped + results.deadlines.skipped,
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
