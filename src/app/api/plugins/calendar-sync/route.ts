/**
 * Calendar-Sync Plugin API Route
 *
 * Handles Google Calendar integration:
 * - GET: Returns sync status
 * - POST with action="connect": Initiates OAuth flow
 * - POST with action="disconnect": Removes tokens
 * - POST with action="sync": Triggers manual sync
 * - POST with action="callback": Handles OAuth callback
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  refreshAccessToken,
  exchangeCodeForTokens,
  getCalendarList,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  mapGoogleEventToSemetra,
  mapSemetraToGoogleEvent,
  type SemetraScheduleEntry,
} from "@/lib/plugins/google-calendar";

const log = logger("api:calendar-sync");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/plugins/calendar-sync/callback`;

interface CalendarSyncConfig {
  encrypted_refresh_token?: string;
  access_token?: string;
  token_expiry?: number;
  google_email?: string;
  calendar_id?: string;
  last_sync?: number;
  sync_enabled?: boolean;
}

// ── GET: Return sync status ──────────────────────────────────────────

/**
 * GET /api/plugins/calendar-sync
 *
 * Returns:
 * - last_sync: timestamp of last successful sync
 * - connected: boolean indicating if Google account is connected
 * - google_email: email of connected Google account (if any)
 * - sync_enabled: whether automatic sync is enabled
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
      .eq("plugin_id", "calendar-sync")
      .single();

    if (pluginError) {
      log.debug("Plugin not installed", { userId: user.id });
      return NextResponse.json(
        {
          connected: false,
          last_sync: null,
          google_email: null,
          sync_enabled: false,
          message: "Plugin nicht installiert",
        },
        { status: 200 }
      );
    }

    const config = (pluginData?.config || {}) as CalendarSyncConfig;

    return NextResponse.json({
      connected: !!config.google_email,
      last_sync: config.last_sync || null,
      google_email: config.google_email || null,
      sync_enabled: config.sync_enabled ?? false,
      calendar_id: config.calendar_id || "primary",
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
 * POST /api/plugins/calendar-sync
 *
 * Body: { action: "connect"|"disconnect"|"sync"|"callback", ... }
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
        return handleConnect();
      case "disconnect":
        return handleDisconnect(user.id, supabase);
      case "sync":
        return handleSync(user.id, supabase);
      case "callback":
        return handleCallback(user.id, body, supabase);
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
        error:
          err instanceof Error ? err.message : "Interner Fehler",
      },
      { status: 500 }
    );
  }
}

// ── Action Handlers ──────────────────────────────────────────────────

/**
 * Generate Google OAuth URL for user to authorize.
 */
function handleConnect() {
  try {
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    log.info("Generated Google OAuth URL");

    return NextResponse.json({
      auth_url: authUrl,
      message: "Bitte melden Sie sich bei Google an",
    });
  } catch (err: unknown) {
    log.error("handleConnect failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Generieren der OAuth-URL" },
      { status: 500 }
    );
  }
}

/**
 * Remove stored Google tokens and disconnect.
 */
async function handleDisconnect(userId: string, supabase: any) {
  try {
    const { error } = await supabase
      .from("user_plugins")
      .update({
        config: {
          sync_enabled: false,
        },
      })
      .eq("user_id", userId)
      .eq("plugin_id", "calendar-sync");

    if (error) {
      log.error("Disconnect update failed", { error });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    log.info("User disconnected Google Calendar", { userId });

    return NextResponse.json({
      ok: true,
      message: "Google Calendar erfolgreich disconnected",
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
 * Trigger manual sync: pull from Google, push to Google.
 */
async function handleSync(userId: string, supabase: any) {
  try {
    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", userId)
      .eq("plugin_id", "calendar-sync")
      .single();

    if (pluginError || !pluginData) {
      return NextResponse.json(
        { error: "Plugin nicht installiert oder konfiguriert" },
        { status: 400 }
      );
    }

    const config = (pluginData.config || {}) as CalendarSyncConfig;

    if (!config.google_email || !config.access_token) {
      return NextResponse.json(
        { error: "Google Calendar nicht verbunden" },
        { status: 400 }
      );
    }

    log.info("Starting sync", { userId });

    let accessToken = config.access_token;

    // Refresh token if needed
    if (config.token_expiry && config.token_expiry < Date.now()) {
      if (!config.encrypted_refresh_token) {
        return NextResponse.json(
          { error: "Refresh Token ungültig" },
          { status: 401 }
        );
      }

      const tokens = await refreshAccessToken(
        config.encrypted_refresh_token,
        {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
        }
      );

      if (!tokens) {
        return NextResponse.json(
          { error: "Token-Aktualisierung fehlgeschlagen" },
          { status: 401 }
        );
      }

      accessToken = tokens.access_token;

      // Update stored tokens
      config.access_token = accessToken;
      if (tokens.refresh_token) {
        config.encrypted_refresh_token = tokens.refresh_token;
      }
      config.token_expiry = Date.now() + tokens.expires_in * 1000;
    }

    // Pull events from Google Calendar
    const googleEvents = await fetchGoogleCalendarEvents(
      accessToken,
      config.calendar_id || "primary"
    );

    log.debug("Fetched Google events", { count: googleEvents.length });

    // Insert/update events in Semetra
    let insertedCount = 0;
    for (const googleEvent of googleEvents) {
      try {
        const entry = mapGoogleEventToSemetra(googleEvent, userId, {
          color: "#3b82f6",
        });

        // Check if event already exists
        const { data: existing } = await supabase
          .from("events")
          .select("id")
          .eq("user_id", userId)
          .eq("google_event_id", googleEvent.id)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from("events")
            .update(entry)
            .eq("id", existing.id);
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from("events")
            .insert([entry]);

          if (!insertError) {
            insertedCount++;
          }
        }
      } catch (err: unknown) {
        log.warn("Failed to insert event", {
          error: err instanceof Error ? err.message : String(err),
          eventId: googleEvent.id,
        });
      }
    }

    // Pull events from Semetra that should be in Google Calendar
    // (exams + task deadlines)
    const now = new Date().toISOString();
    const ninetyDaysLater = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch exams
    const { data: exams } = await supabase
      .from("exams")
      .select("id, title, exam_date, location")
      .eq("user_id", userId)
      .gte("exam_date", now)
      .lte("exam_date", ninetyDaysLater);

    // Fetch task deadlines
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, module_id")
      .eq("user_id", userId)
      .gte("due_date", now)
      .lte("due_date", ninetyDaysLater);

    let pushCount = 0;

    // Push exams to Google Calendar
    if (exams) {
      for (const exam of exams) {
        try {
          const entry: SemetraScheduleEntry = {
            user_id: userId,
            title: `Prüfung: ${exam.title}`,
            start_dt: exam.exam_date,
            end_dt: null,
            location: exam.location || null,
            description: `Prüfung für ${exam.title}`,
            color: "#ef4444",
            event_type: "exam",
            module_id: null,
          };

          const googleEvent = mapSemetraToGoogleEvent(entry);

          // Check if already in Google Calendar
          const { data: existing } = await supabase
            .from("events")
            .select("google_event_id")
            .eq("user_id", userId)
            .eq("event_type", "exam")
            .eq("module_id", null) // Simple check, could be improved
            .single();

          if (!existing?.google_event_id) {
            const created = await createGoogleCalendarEvent(
              accessToken,
              googleEvent,
              config.calendar_id || "primary"
            );

            if (created) {
              pushCount++;
            }
          }
        } catch (err: unknown) {
          log.warn("Failed to push exam", {
            error: err instanceof Error ? err.message : String(err),
            examId: exam.id,
          });
        }
      }
    }

    // Push tasks to Google Calendar
    if (tasks) {
      for (const task of tasks) {
        try {
          const entry: SemetraScheduleEntry = {
            user_id: userId,
            title: `Aufgabe: ${task.title}`,
            start_dt: task.due_date,
            end_dt: null,
            location: null,
            description: `Aufgabenfrist: ${task.title}`,
            color: "#8b5cf6",
            event_type: "task",
            module_id: task.module_id,
          };

          const googleEvent = mapSemetraToGoogleEvent(entry);

          // Check if already in Google Calendar
          const { data: existing } = await supabase
            .from("events")
            .select("google_event_id")
            .eq("user_id", userId)
            .eq("event_type", "task")
            .eq("module_id", task.module_id)
            .single();

          if (!existing?.google_event_id) {
            const created = await createGoogleCalendarEvent(
              accessToken,
              googleEvent,
              config.calendar_id || "primary"
            );

            if (created) {
              pushCount++;
            }
          }
        } catch (err: unknown) {
          log.warn("Failed to push task", {
            error: err instanceof Error ? err.message : String(err),
            taskId: task.id,
          });
        }
      }
    }

    // Update last_sync timestamp
    config.last_sync = Date.now();
    config.access_token = accessToken;

    const { error: updateError } = await supabase
      .from("user_plugins")
      .update({ config })
      .eq("user_id", userId)
      .eq("plugin_id", "calendar-sync");

    if (updateError) {
      log.error("Failed to update sync timestamp", { error: updateError });
    }

    log.info("Sync completed", {
      userId,
      pulled: insertedCount,
      pushed: pushCount,
    });

    return NextResponse.json({
      ok: true,
      pulled: insertedCount,
      pushed: pushCount,
      message: `Sync abgeschlossen: ${insertedCount} gezogen, ${pushCount} gepusht`,
    });
  } catch (err: unknown) {
    log.error("handleSync failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Synchronisieren" },
      { status: 500 }
    );
  }
}

/**
 * Handle OAuth callback with authorization code.
 * Exchanges code for tokens and stores them.
 */
async function handleCallback(
  userId: string,
  body: any,
  supabase: any
) {
  try {
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Autorisierungscode erforderlich" },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    });

    if (!tokens) {
      return NextResponse.json(
        { error: "Token-Austausch fehlgeschlagen" },
        { status: 401 }
      );
    }

    // Get user's Google email
    const meResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let googleEmail = "unknown@gmail.com";
    if (meResponse.ok) {
      const userData = (await meResponse.json()) as { email?: string };
      googleEmail = userData.email || googleEmail;
    }

    // Get primary calendar ID
    const calendars = await getCalendarList(tokens.access_token);
    const primaryCalendar = calendars.find((c) => c.primary);
    const calendarId = primaryCalendar?.id || "primary";

    // Store tokens in user_plugins config
    const config: CalendarSyncConfig = {
      encrypted_refresh_token: tokens.refresh_token || "",
      access_token: tokens.access_token,
      token_expiry: Date.now() + tokens.expires_in * 1000,
      google_email: googleEmail,
      calendar_id: calendarId,
      sync_enabled: true,
      last_sync: Date.now(),
    };

    // Ensure plugin is installed first
    const { data: existing } = await supabase
      .from("user_plugins")
      .select("id")
      .eq("user_id", userId)
      .eq("plugin_id", "calendar-sync")
      .single();

    if (!existing) {
      // Install plugin
      const { error: installError } = await supabase
        .from("user_plugins")
        .insert({
          user_id: userId,
          plugin_id: "calendar-sync",
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
        .eq("plugin_id", "calendar-sync");

      if (updateError) {
        log.error("Failed to update plugin config", { error: updateError });
        return NextResponse.json(
          { error: "Fehler beim Aktualisieren der Konfiguration" },
          { status: 500 }
        );
      }
    }

    log.info("OAuth callback successful", {
      userId,
      googleEmail,
      calendarId,
    });

    return NextResponse.json({
      ok: true,
      google_email: googleEmail,
      calendar_id: calendarId,
      message: `Google Calendar erfolgreich verbunden: ${googleEmail}`,
    });
  } catch (err: unknown) {
    log.error("handleCallback failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des Callbacks" },
      { status: 500 }
    );
  }
}
