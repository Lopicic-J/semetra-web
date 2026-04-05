/**
 * API Route Helpers
 *
 * Shared utilities for Next.js API routes to reduce boilerplate.
 * Handles auth checks, error responses, and request parsing.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const log = logger("api:helpers");

/** Standard JSON error response */
export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Standard success response */
export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Auth context returned by withAuth */
export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Authenticate the request and return supabase client + user.
 * Returns an error response if not authenticated.
 *
 * Usage:
 * ```ts
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth; // error response
 * const { supabase, user } = auth;
 * ```
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Nicht autorisiert", 401);
    }

    return { supabase, user };
  } catch (err) {
    log.error("Auth check failed", err);
    return errorResponse("Authentifizierungsfehler", 500);
  }
}

/**
 * Safely parse JSON body from a request.
 * Returns parsed body or an error response.
 */
export async function parseBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return errorResponse("Ungültiger Request-Body", 400);
  }
}

/**
 * Wrap an API route handler with try/catch + logging.
 * Catches unhandled errors and returns a clean 500 response.
 */
export function withErrorHandler(
  namespace: string,
  handler: () => Promise<NextResponse | Response>,
): Promise<NextResponse | Response> {
  const routeLog = logger(namespace);
  return handler().catch((err: unknown) => {
    routeLog.error("Unhandled error", err);
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  });
}

/** Type guard: checks if the value is a NextResponse (error) */
export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
