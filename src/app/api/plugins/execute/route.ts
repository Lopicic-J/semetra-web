import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("api:plugins:execute");

/**
 * POST /api/plugins/execute
 *
 * Execute an installed and enabled plugin.
 *
 * Body: { pluginId: string, action?: string }
 *
 * Returns different response formats based on plugin:
 * - { type: "download", filename: string, content: string, mimeType: string }
 * - { type: "data", stats: {...} }
 * - { type: "config", ...config }
 * - { error: string, status: number }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { pluginId, action } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: "pluginId erforderlich" },
        { status: 400 }
      );
    }

    // Verify plugin is installed and enabled for this user
    const { data: userPlugin, error: checkError } = await supabase
      .from("user_plugins")
      .select("id, plugin_id, enabled, config")
      .eq("user_id", user.id)
      .eq("plugin_id", pluginId)
      .single();

    if (checkError || !userPlugin) {
      log.warn("Plugin not installed", { userId: user.id, pluginId });
      return NextResponse.json(
        { error: "Plugin nicht installiert" },
        { status: 404 }
      );
    }

    if (!userPlugin.enabled) {
      log.warn("Plugin disabled", { userId: user.id, pluginId });
      return NextResponse.json(
        { error: "Plugin ist deaktiviert" },
        { status: 403 }
      );
    }

    // Execute plugin based on ID
    if (pluginId === "grade-export") {
      return handleGradeExport(supabase, user.id);
    } else if (pluginId === "pomodoro-plus") {
      return handlePomodoroPlusAction(supabase, user.id, action, userPlugin.config);
    } else {
      log.warn("No execution logic for plugin", { pluginId });
      return NextResponse.json(
        { error: "Plugin hat keine Ausführungslogik", status: 501 },
        { status: 501 }
      );
    }
  } catch (err: unknown) {
    log.error("POST execute failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

/**
 * Handle grade-export plugin execution.
 * Fetches all grades for the user, joins with modules, and returns CSV.
 */
async function handleGradeExport(supabase: any, userId: string) {
  try {
    // Fetch all grades with module details
    const { data: grades, error } = await supabase
      .from("grades")
      .select(
        `
        id,
        title,
        grade,
        date,
        module_id,
        modules(name, ects)
      `
      )
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      log.error("Failed to fetch grades", { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!grades || grades.length === 0) {
      // Return empty CSV with headers
      const headers = "Modul,Code,Note,ECTS,Datum,Semester\n";
      const filename = `noten_export_${getFormattedDate()}.csv`;
      return NextResponse.json({
        type: "download",
        filename,
        content: headers,
        mimeType: "text/csv",
      });
    }

    // Build CSV content
    const csvLines: string[] = ["Modul,Code,Note,ECTS,Datum,Semester"];

    for (const grade of grades) {
      const moduleName = grade.modules?.name || "";
      const moduleCode = grade.modules?.name || grade.title || ""; // Use title as code if no name
      const note = formatGermanNumber(grade.grade);
      const ects = grade.modules?.ects || "";
      const datum = grade.date || "";
      const semester = ""; // Not in schema, leave empty

      // Escape CSV values
      const row = [
        escapeCsvValue(moduleName),
        escapeCsvValue(moduleCode),
        note,
        ects,
        datum,
        semester,
      ].join(",");

      csvLines.push(row);
    }

    const csvContent = csvLines.join("\n");
    const filename = `noten_export_${getFormattedDate()}.csv`;

    return NextResponse.json({
      type: "download",
      filename,
      content: csvContent,
      mimeType: "text/csv",
    });
  } catch (err: unknown) {
    log.error("grade-export execution failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export fehlgeschlagen" },
      { status: 500 }
    );
  }
}

/**
 * Handle pomodoro-plus plugin execution.
 * Supports "stats" and "focus-mode" actions.
 */
async function handlePomodoroPlusAction(
  supabase: any,
  userId: string,
  action: string | undefined,
  config: Record<string, any>
) {
  try {
    if (action === "stats") {
      return handlePomodoroStats(supabase, userId);
    } else if (action === "focus-mode") {
      return handlePomodorFocusMode(config);
    } else {
      // Default to stats
      return handlePomodoroStats(supabase, userId);
    }
  } catch (err: unknown) {
    log.error("pomodoro-plus execution failed", { error: err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pomodoro-Fehler" },
      { status: 500 }
    );
  }
}

/**
 * Get pomodoro stats for the last 30 days.
 */
async function handlePomodoroStats(supabase: any, userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const isoDate = thirtyDaysAgo.toISOString();

  // Fetch time_logs for last 30 days
  const { data: timeLogs, error } = await supabase
    .from("time_logs")
    .select("id, duration_seconds, started_at, created_at")
    .eq("user_id", userId)
    .gte("created_at", isoDate)
    .order("created_at", { ascending: false });

  if (error) {
    log.error("Failed to fetch time_logs", { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!timeLogs || timeLogs.length === 0) {
    return NextResponse.json({
      type: "data",
      stats: {
        totalSessions: 0,
        totalMinutes: 0,
        avgSessionMinutes: 0,
        last30Days: {},
        longestSession: 0,
        todaySessions: 0,
        todayMinutes: 0,
      },
    });
  }

  // Calculate statistics
  let totalMinutes = 0;
  let longestSession = 0;
  const dayMap: Record<string, number> = {};

  const today = new Date().toISOString().split("T")[0];
  let todaySessions = 0;
  let todayMinutes = 0;

  for (const log of timeLogs) {
    const minutes = Math.round(log.duration_seconds / 60);
    totalMinutes += minutes;
    longestSession = Math.max(longestSession, minutes);

    // Group by day (ISO date)
    const day = log.created_at
      ? new Date(log.created_at).toISOString().split("T")[0]
      : "";
    if (day) {
      dayMap[day] = (dayMap[day] || 0) + minutes;

      // Check if today
      if (day === today) {
        todaySessions++;
        todayMinutes += minutes;
      }
    }
  }

  const avgSessionMinutes = Math.round(totalMinutes / timeLogs.length);

  return NextResponse.json({
    type: "data",
    stats: {
      totalSessions: timeLogs.length,
      totalMinutes,
      avgSessionMinutes,
      last30Days: dayMap,
      longestSession,
      todaySessions,
      todayMinutes,
    },
  });
}

/**
 * Get pomodoro focus mode configuration.
 */
function handlePomodorFocusMode(config: Record<string, any>) {
  // Defaults: 25 min focus, 5 min break, 15 min long break, 4 sessions before long break
  const focusMinutes = config?.focusMinutes ?? 25;
  const breakMinutes = config?.breakMinutes ?? 5;
  const longBreakMinutes = config?.longBreakMinutes ?? 15;
  const sessionsBeforeLongBreak = config?.sessionsBeforeLongBreak ?? 4;

  return NextResponse.json({
    type: "config",
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    sessionsBeforeLongBreak,
  });
}

/**
 * Helper: Format a number using German number format (comma for decimal).
 * Example: 2.5 -> "2,5"
 */
function formatGermanNumber(num: number | string): string {
  if (typeof num === "string") {
    return num.replace(".", ",");
  }
  return num.toString().replace(".", ",");
}

/**
 * Helper: Get formatted date string for filename (YYYY-MM-DD).
 */
function getFormattedDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Escape CSV values (quote if contains comma, newline, or quote).
 */
function escapeCsvValue(value: string | undefined | null): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
