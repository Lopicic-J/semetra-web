/**
 * Moodle-Sync Plugin API Route
 *
 * Handles Moodle LMS integration:
 * - GET: Returns connection status
 * - POST with action="connect": Establishes connection using token-based auth
 * - POST with action="disconnect": Removes stored connection info
 * - POST with action="sync": Pulls courses, assignments, and grades from Moodle
 * - POST with action="test": Tests the connection
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  createMoodleClient,
  testMoodleConnection,
  mapMoodleCourseToSemetra,
  mapMoodleAssignmentToSemetra,
  mapMoodleGradeToSemetra,
  isValidMoodleUrl,
  type SemetraMappedCourse,
  type SemetraMappedAssignment,
  type SemetraMappedGrade,
} from "@/lib/plugins/moodle-api";

const log = logger("api:moodle-sync");

interface MoodleSyncConfig {
  moodle_url?: string;
  token?: string;
  username?: string;
  site_name?: string;
  last_sync?: number;
  synced_courses?: Array<{
    moodleId: number;
    semetraModuleId?: string;
  }>;
}

// ── GET: Return sync status ──────────────────────────────────────────

/**
 * GET /api/plugins/moodle-sync
 *
 * Returns:
 * - connected: boolean indicating if Moodle is connected
 * - moodle_url: connected Moodle URL (if any)
 * - username: username of connected Moodle account (if any)
 * - site_name: name of the Moodle instance (if any)
 * - last_sync: timestamp of last successful sync
 * - synced_courses: count of synced courses
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", user.id)
      .eq("plugin_id", "moodle-sync")
      .single();

    if (pluginError) {
      log.debug("Plugin not installed", { userId: user.id });
      return NextResponse.json(
        {
          connected: false,
          moodle_url: null,
          username: null,
          site_name: null,
          last_sync: null,
          synced_courses: 0,
          message: "Plugin nicht installiert",
        },
        { status: 200 }
      );
    }

    const config = (pluginData?.config || {}) as MoodleSyncConfig;

    return NextResponse.json({
      connected: !!config.moodle_url && !!config.token,
      moodle_url: config.moodle_url || null,
      username: config.username || null,
      site_name: config.site_name || null,
      last_sync: config.last_sync || null,
      synced_courses: config.synced_courses?.length || 0,
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Sync-Status" },
      { status: 500 }
    );
  }
}

// ── POST: Handle actions ─────────────────────────────────────────────

/**
 * POST /api/plugins/moodle-sync
 *
 * Body: { action: "connect"|"disconnect"|"sync"|"test", ... }
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
    const { action } = body;

    switch (action) {
      case "connect":
        return handleConnect(user.id, body, supabase);
      case "disconnect":
        return handleDisconnect(user.id, supabase);
      case "sync":
        return handleSync(user.id, supabase);
      case "test":
        return handleTest(body);
      default:
        return NextResponse.json(
          { error: "Ungültige Aktion" },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Interner Fehler",
      },
      { status: 500 }
    );
  }
}

// ── Action Handlers ──────────────────────────────────────────────────

/**
 * Test Moodle connection (without storing credentials)
 */
async function handleTest(body: any) {
  try {
    const { moodle_url, token } = body;

    if (!moodle_url || !token) {
      return NextResponse.json(
        { error: "Moodle-URL und Token erforderlich" },
        { status: 400 }
      );
    }

    if (!isValidMoodleUrl(moodle_url)) {
      return NextResponse.json(
        { error: "Ungültige Moodle-URL-Format" },
        { status: 400 }
      );
    }

    const result = await testMoodleConnection(moodle_url, token);

    if (!result.ok) {
      log.warn("Test connection failed", { error: result.error });
      return NextResponse.json(
        { error: result.error || "Verbindung fehlgeschlagen" },
        { status: 401 }
      );
    }

    log.info("Test connection successful", {
      sitename: result.siteInfo?.sitename,
    });

    return NextResponse.json({
      ok: true,
      site_name: result.siteInfo?.sitename,
      username: result.siteInfo?.username,
      message: `Verbindung erfolgreich: ${result.siteInfo?.sitename}`,
    });
  } catch (err: unknown) {
    log.error("handleTest failed", { error: err });
    return NextResponse.json(
      { error: "Verbindungstest fehlgeschlagen" },
      { status: 500 }
    );
  }
}

/**
 * Connect to Moodle using URL and token
 */
async function handleConnect(userId: string, body: any, supabase: any) {
  try {
    const { moodle_url, token } = body;

    if (!moodle_url || !token) {
      return NextResponse.json(
        { error: "Moodle-URL und Token erforderlich" },
        { status: 400 }
      );
    }

    if (!isValidMoodleUrl(moodle_url)) {
      return NextResponse.json(
        { error: "Ungültige Moodle-URL-Format" },
        { status: 400 }
      );
    }

    // Test connection first
    const result = await testMoodleConnection(moodle_url, token);

    if (!result.ok) {
      log.warn("Connect: test failed", { error: result.error });
      return NextResponse.json(
        { error: result.error || "Verbindung fehlgeschlagen" },
        { status: 401 }
      );
    }

    // Build config
    const config: MoodleSyncConfig = {
      moodle_url,
      token,
      username: result.siteInfo?.username || "unknown",
      site_name: result.siteInfo?.sitename || "Moodle",
      last_sync: null,
      synced_courses: [],
    };

    // Check if plugin is already installed
    const { data: existing } = await supabase
      .from("user_plugins")
      .select("id")
      .eq("user_id", userId)
      .eq("plugin_id", "moodle-sync")
      .single();

    if (!existing) {
      // Install plugin
      const { error: installError } = await supabase
        .from("user_plugins")
        .insert({
          user_id: userId,
          plugin_id: "moodle-sync",
          enabled: true,
          config,
        });

      if (installError) {
        log.error("Failed to install plugin", { error: installError });
        return NextResponse.json(
          { error: "Fehler beim Installieren des Plugins" },
          { status: 500 }
        );
      }
    } else {
      // Update existing
      const { error: updateError } = await supabase
        .from("user_plugins")
        .update({ config, enabled: true })
        .eq("user_id", userId)
        .eq("plugin_id", "moodle-sync");

      if (updateError) {
        log.error("Failed to update plugin config", { error: updateError });
        return NextResponse.json(
          { error: "Fehler beim Aktualisieren der Konfiguration" },
          { status: 500 }
        );
      }
    }

    log.info("Moodle connected", {
      userId,
      moodleUrl: moodle_url,
      username: result.siteInfo?.username,
    });

    return NextResponse.json(
      {
        ok: true,
        site_name: result.siteInfo?.sitename,
        username: result.siteInfo?.username,
        message: `Moodle erfolgreich verbunden: ${result.siteInfo?.sitename}`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    log.error("handleConnect failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Verbinden" },
      { status: 500 }
    );
  }
}

/**
 * Disconnect from Moodle
 */
async function handleDisconnect(userId: string, supabase: any) {
  try {
    const { error } = await supabase
      .from("user_plugins")
      .update({
        config: {
          synced_courses: [],
        },
        enabled: false,
      })
      .eq("user_id", userId)
      .eq("plugin_id", "moodle-sync");

    if (error) {
      log.error("Disconnect update failed", { error });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    log.info("User disconnected Moodle", { userId });

    return NextResponse.json({
      ok: true,
      message: "Moodle erfolgreich getrennt",
    });
  } catch (err: unknown) {
    log.error("handleDisconnect failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Trennen" },
      { status: 500 }
    );
  }
}

/**
 * Trigger full sync: pull courses, assignments, and grades from Moodle
 */
async function handleSync(userId: string, supabase: any) {
  try {
    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", userId)
      .eq("plugin_id", "moodle-sync")
      .single();

    if (pluginError || !pluginData) {
      return NextResponse.json(
        { error: "Plugin nicht installiert oder konfiguriert" },
        { status: 400 }
      );
    }

    const config = (pluginData.config || {}) as MoodleSyncConfig;

    if (!config.moodle_url || !config.token) {
      return NextResponse.json(
        { error: "Moodle nicht verbunden" },
        { status: 400 }
      );
    }

    log.info("Starting Moodle sync", { userId, moodleUrl: config.moodle_url });

    // Create Moodle client
    const moodleClient = createMoodleClient(config.moodle_url, config.token);

    // Fetch enrolled courses
    let courses: SemetraMappedCourse[] = [];
    let assignmentCount = 0;
    let gradeCount = 0;

    try {
      const moodleCourses = await moodleClient.getCourses();
      log.debug("Fetched Moodle courses", { count: moodleCourses.length });

      courses = moodleCourses.map(mapMoodleCourseToSemetra);

      // For each course, fetch assignments and grades
      for (const moodleCourse of moodleCourses) {
        try {
          // Fetch assignments
          const assignments = await moodleClient.getAssignments(moodleCourse.id);
          const mappedAssignments = assignments.map((a) =>
            mapMoodleAssignmentToSemetra(a, moodleCourse.id)
          );

          log.debug("Fetched assignments", {
            course: moodleCourse.shortname,
            count: assignments.length,
          });

          assignmentCount += assignments.length;

          // Fetch grades
          const gradesData = await moodleClient.getGrades(moodleCourse.id);
          const mappedGrades: SemetraMappedGrade[] = [];

          for (const item of gradesData.items) {
            const grade = gradesData.grades.find((g) => g.itemid === item.id);
            if (grade) {
              mappedGrades.push(
                mapMoodleGradeToSemetra(item, grade, moodleCourse.id)
              );
            }
          }

          log.debug("Fetched grades", {
            course: moodleCourse.shortname,
            count: mappedGrades.length,
          });

          gradeCount += mappedGrades.length;
        } catch (err: unknown) {
          log.warn("Failed to fetch course details", {
            courseId: moodleCourse.id,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue with next course on error
        }
      }
    } catch (err: unknown) {
      log.error("Failed to fetch courses", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Fehler beim Abrufen von Kursen" },
        { status: 500 }
      );
    }

    // Update sync config
    config.last_sync = Date.now();
    config.synced_courses = courses.map((c) => ({
      moodleId: c.moodleId,
      semetraModuleId: undefined,
    }));

    const { error: updateError } = await supabase
      .from("user_plugins")
      .update({ config })
      .eq("user_id", userId)
      .eq("plugin_id", "moodle-sync");

    if (updateError) {
      log.error("Failed to update sync timestamp", { error: updateError });
    }

    log.info("Moodle sync completed", {
      userId,
      courses: courses.length,
      assignments: assignmentCount,
      grades: gradeCount,
    });

    return NextResponse.json(
      {
        ok: true,
        courses: courses.length,
        assignments: assignmentCount,
        grades: gradeCount,
        message: `Sync abgeschlossen: ${courses.length} Kurse, ${assignmentCount} Aufgaben, ${gradeCount} Noten`,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    log.error("handleSync failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Synchronisieren" },
      { status: 500 }
    );
  }
}
