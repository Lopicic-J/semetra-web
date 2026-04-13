import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Add security headers to all responses
  if (response) {
    // Strict CSP for plugin/webhook API routes
    if (request.nextUrl.pathname.startsWith("/api/plugins") ||
        request.nextUrl.pathname.startsWith("/api/webhooks")) {
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'"
      );
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("Cache-Control", "no-store");
    }

    // General security headers for all routes
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
