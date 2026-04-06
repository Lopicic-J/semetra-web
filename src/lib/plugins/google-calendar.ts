/**
 * Google Calendar Integration Helper
 *
 * Handles OAuth token refresh, fetching events from Google Calendar API,
 * and mapping between Google Calendar and Semetra schedule formats.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  iCalUID?: string;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface SemetraScheduleEntry {
  id?: string;
  user_id: string;
  title: string;
  start_dt: string;
  end_dt: string | null;
  location: string | null;
  description: string | null;
  color: string;
  event_type: string;
  module_id: string | null;
  created_at?: string;
  google_event_id?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// ── OAuth Token Management ────────────────────────────────────────────

/**
 * Refresh a Google OAuth access token using the refresh token.
 * Returns new tokens if successful.
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: GoogleOAuthConfig
): Promise<TokenResponse | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Token refresh failed:", error);
      return null;
    }

    const data = (await response.json()) as TokenResponse;
    return data;
  } catch (err) {
    console.error("Token refresh error:", err);
    return null;
  }
}

/**
 * Exchange authorization code for tokens (used in OAuth callback).
 */
export async function exchangeCodeForTokens(
  code: string,
  config: GoogleOAuthConfig
): Promise<TokenResponse | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Code exchange failed:", error);
      return null;
    }

    const data = (await response.json()) as TokenResponse;
    return data;
  } catch (err) {
    console.error("Code exchange error:", err);
    return null;
  }
}

// ── Google Calendar API ──────────────────────────────────────────────

/**
 * Fetch user's Google Calendar list to find the primary calendar ID.
 */
export async function getCalendarList(
  accessToken: string
): Promise<GoogleCalendarListItem[]> {
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch calendar list:", response.statusText);
      return [];
    }

    const data = (await response.json()) as { items?: GoogleCalendarListItem[] };
    return data.items ?? [];
  } catch (err) {
    console.error("Error fetching calendar list:", err);
    return [];
  }
}

/**
 * Fetch events from Google Calendar for a given date range.
 * Returns events in the next 90 days by default.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string = "primary",
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
): Promise<GoogleEvent[]> {
  try {
    const now = new Date();
    const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      orderBy: "startTime",
      singleEvents: "true",
      timeMin: options?.timeMin ?? now.toISOString(),
      timeMax: options?.timeMax ?? ninetyDaysLater.toISOString(),
      maxResults: String(options?.maxResults ?? 250),
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch events:", response.statusText);
      return [];
    }

    const data = (await response.json()) as { items?: GoogleEvent[] };
    return data.items ?? [];
  } catch (err) {
    console.error("Error fetching Google Calendar events:", err);
    return [];
  }
}

/**
 * Create an event in Google Calendar.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: Partial<GoogleEvent>,
  calendarId: string = "primary"
): Promise<GoogleEvent | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to create event:", error);
      return null;
    }

    const data = (await response.json()) as GoogleEvent;
    return data;
  } catch (err) {
    console.error("Error creating Google Calendar event:", err);
    return null;
  }
}

/**
 * Update an event in Google Calendar.
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Partial<GoogleEvent>,
  calendarId: string = "primary"
): Promise<GoogleEvent | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to update event:", error);
      return null;
    }

    const data = (await response.json()) as GoogleEvent;
    return data;
  } catch (err) {
    console.error("Error updating Google Calendar event:", err);
    return null;
  }
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = "primary"
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.ok || response.status === 204;
  } catch (err) {
    console.error("Error deleting Google Calendar event:", err);
    return false;
  }
}

// ── Mapping Functions ────────────────────────────────────────────────

/**
 * Convert a Google Calendar event to a Semetra schedule entry.
 */
export function mapGoogleEventToSemetra(
  googleEvent: GoogleEvent,
  userId: string,
  options?: {
    color?: string;
    moduleId?: string | null;
  }
): SemetraScheduleEntry {
  // Extract start and end times
  const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
  const endDateTime = googleEvent.end?.dateTime || googleEvent.end?.date;

  if (!startDateTime) {
    throw new Error("Google event must have a start time");
  }

  return {
    user_id: userId,
    title: googleEvent.summary || "Untitled Event",
    start_dt: startDateTime,
    end_dt: endDateTime || null,
    location: googleEvent.location || null,
    description: googleEvent.description || null,
    color: options?.color || "#3b82f6",
    event_type: "google-calendar",
    module_id: options?.moduleId || null,
    google_event_id: googleEvent.id,
  };
}

/**
 * Convert a Semetra schedule entry to a Google Calendar event.
 */
export function mapSemetraToGoogleEvent(
  entry: SemetraScheduleEntry
): Partial<GoogleEvent> {
  return {
    summary: entry.title,
    description: entry.description || undefined,
    start: {
      dateTime: entry.start_dt,
      timeZone: "Europe/Zurich",
    },
    end: entry.end_dt
      ? {
          dateTime: entry.end_dt,
          timeZone: "Europe/Zurich",
        }
      : undefined,
    location: entry.location || undefined,
  };
}

/**
 * Parse ISO datetime string to ensure it's in the correct format for Google Calendar.
 */
export function ensureISODateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString();
  } catch {
    // If parsing fails, return as-is
    return dateString;
  }
}
