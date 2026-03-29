import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { moodleUrl, username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Benutzername und Passwort erforderlich." }, { status: 400 });
    }

    const base = (moodleUrl ?? "https://moodle.ffhs.ch").replace(/\/$/, "");

    // Step 1: Get login token from Moodle login page
    const loginPageRes = await fetch(`${base}/login/index.php`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Semetra/1.0)" },
      redirect: "follow",
    });

    if (!loginPageRes.ok) {
      return NextResponse.json(
        { error: `Moodle nicht erreichbar (${loginPageRes.status}). URL korrekt?` },
        { status: 502 }
      );
    }

    const loginHtml = await loginPageRes.text();
    const cookieHeader = loginPageRes.headers.get("set-cookie") ?? "";

    // Extract logintoken
    const tokenMatch = loginHtml.match(/name="logintoken"\s+value="([^"]+)"/);
    const logintoken = tokenMatch?.[1] ?? "";

    // Step 2: POST login credentials
    const formData = new URLSearchParams({
      username,
      password,
      logintoken,
      anchor: "",
    });

    const loginRes = await fetch(`${base}/login/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; Semetra/1.0)",
        Cookie: extractSessionCookies(cookieHeader),
      },
      body: formData.toString(),
      redirect: "manual",
    });

    // Moodle redirects on success
    const sessionCookies = combineSessionCookies(
      cookieHeader,
      loginRes.headers.get("set-cookie") ?? ""
    );

    const redirectUrl = loginRes.headers.get("location");
    if (!redirectUrl || redirectUrl.includes("login")) {
      return NextResponse.json(
        { error: "Login fehlgeschlagen. Bitte Benutzername und Passwort prüfen." },
        { status: 401 }
      );
    }

    // Step 3: Fetch the dashboard / my courses
    const dashRes = await fetch(`${base}/my/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Semetra/1.0)",
        Cookie: sessionCookies,
      },
      redirect: "follow",
    });

    const dashHtml = await dashRes.text();

    // Parse modules from course list
    const modules = parseCoursesFromHtml(dashHtml, base);

    // Step 4: Try to fetch calendar / upcoming events
    let events: Array<{ title: string; start_dt: string; end_dt?: string; location?: string }> = [];
    try {
      const calRes = await fetch(`${base}/calendar/view.php?view=upcoming`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Semetra/1.0)",
          Cookie: sessionCookies,
        },
        redirect: "follow",
      });
      const calHtml = await calRes.text();
      events = parseEventsFromHtml(calHtml);
    } catch {
      // Calendar is optional — ignore errors
    }

    return NextResponse.json({
      modules,
      events,
      rawHtml: dashHtml.substring(0, 5000), // debug snippet
    });

  } catch (err: unknown) {
    console.error("[scrap] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler beim Scraping." },
      { status: 500 }
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractSessionCookies(setCookieHeader: string): string {
  return setCookieHeader
    .split(/,(?=\s*\w+=)/)
    .map(c => c.split(";")[0].trim())
    .join("; ");
}

function combineSessionCookies(a: string, b: string): string {
  const parse = (h: string) =>
    h.split(/,(?=\s*\w+=)/).map(c => c.split(";")[0].trim()).filter(Boolean);
  const all = [...parse(a), ...parse(b)];
  // Deduplicate by key
  const map = new Map<string, string>();
  all.forEach(kv => {
    const [k] = kv.split("=");
    map.set(k.trim(), kv);
  });
  return [...map.values()].join("; ");
}

function parseCoursesFromHtml(html: string, base: string) {
  const modules: Array<{
    name: string;
    code: string;
    ects: number;
    semester: string;
    link?: string;
  }> = [];

  // Moodle course titles typically appear in <a> tags with /course/view.php
  const courseRegex = /<a[^>]+href="([^"]*course\/view\.php\?id=\d+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  const seen = new Set<string>();

  while ((match = courseRegex.exec(html)) !== null) {
    const link = match[1].startsWith("http") ? match[1] : `${base}${match[1]}`;
    const rawName = match[2].replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();

    if (!rawName || rawName.length < 3 || seen.has(rawName)) continue;
    seen.add(rawName);

    // Try to extract module code from patterns like "MAT1 - Mathematik 1" or "W.XXXX.xx.yy"
    const codeMatch = rawName.match(/^([A-Z][A-Z0-9_.]{1,12})\s*[-–:]/);
    const code = codeMatch?.[1] ?? "";
    const name = codeMatch ? rawName.slice(codeMatch[0].length).trim() : rawName;

    // Detect semester from name (HS/FS + year patterns)
    const semMatch = rawName.match(/\b(HS|FS)\s*(\d{2,4})\b/i);
    const semester = semMatch ? `${semMatch[1].toUpperCase()}${semMatch[2]}` : "";

    modules.push({ name: name || rawName, code, ects: 0, semester, link });
  }

  return modules;
}

function parseEventsFromHtml(html: string) {
  const events: Array<{ title: string; start_dt: string; end_dt?: string; location?: string }> = [];

  // Moodle upcoming events typically have class="event" with a title and date
  const eventRegex = /<div[^>]+class="[^"]*event[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  let match;

  while ((match = eventRegex.exec(html)) !== null) {
    const block = match[0];
    const titleMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>/i) ??
                       block.match(/class="name"[^>]*>([^<]+)</i);
    const dateMatch  = block.match(/<span[^>]+class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/i) ??
                       block.match(/datetime="([^"]+)"/i);

    if (titleMatch && dateMatch) {
      const title = titleMatch[1].replace(/&amp;/g, "&").trim();
      const rawDate = dateMatch[1].trim();
      // Try to parse to ISO date
      const parsed = new Date(rawDate);
      const start_dt = isNaN(parsed.getTime()) ? rawDate : parsed.toISOString();

      events.push({ title, start_dt });
    }
  }

  return events.slice(0, 50); // max 50 events
}
