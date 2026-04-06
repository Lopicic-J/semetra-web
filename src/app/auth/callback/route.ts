import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function safeRedirectPath(path: string | null): string {
  const fallback = "/dashboard";
  if (!path) return fallback;
  // Must start with single slash, no protocol-relative or absolute URLs
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return fallback;
  // No backslashes or encoded characters that could bypass checks
  if (path.includes("\\") || path.includes("%2f") || path.includes("%2F")) return fallback;
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie errors in read-only contexts
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Redirect to login with error if code exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
