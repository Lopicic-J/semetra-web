/**
 * API Route Helpers
 *
 * Shared utilities for Next.js API routes to reduce boilerplate.
 * Handles auth checks, error responses, and request parsing.
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
/**
 * Create a Supabase client with the service role key (bypasses RLS).
 * Use ONLY in admin API routes after verifying the user is an admin.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  return createSupabaseClient(url, key);
}

export async function requireAuth(): Promise<AuthContext | NextResponse> {
  try {
    const supabase = await createSessionClient();
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

// ── User Role Helpers ─────────────────────────────────────────────────────

export type UserRole = "admin" | "institution" | "student" | "non_student";

/** @deprecated Use UserRole instead */
export type BuilderRole = UserRole;

export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

export interface RoleContext extends AuthContext {
  userRole: UserRole;
  /** @deprecated Use userRole instead */
  builderRole: UserRole;
  /** Service-role client that bypasses RLS — only available for admin routes */
  adminClient: SupabaseClient | null;
}

/**
 * Check that the authenticated user has one of the allowed roles.
 * Returns RoleContext on success, or a 403 NextResponse on failure.
 *
 * Usage:
 * ```ts
 * const rc = await requireRole(["admin", "institution"]);
 * if (rc instanceof NextResponse) return rc;
 * const { supabase, user, userRole } = rc;
 * ```
 */
export async function requireRole(
  allowed: UserRole[],
): Promise<RoleContext | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { supabase, user } = auth;
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("id", user.id)
    .single();

  const role = (profile?.user_role as UserRole) ?? "non_student";

  if (!allowed.includes(role)) {
    return errorResponse("Keine Berechtigung für diese Aktion", 403);
  }

  // Provide service-role client for admin users (bypasses RLS for cross-user queries)
  const adminClient = role === "admin" ? createServiceClient() : null;

  return { supabase, user, userRole: role, builderRole: role, adminClient };
}

/**
 * Check if the user can manage a specific institution.
 * Admins can manage all, institution users only their assigned ones.
 */
export async function canManageInstitution(
  supabase: SupabaseClient,
  userId: string,
  institutionId: string,
  userRole: UserRole,
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userRole !== "institution") return false;

  const { data } = await supabase
    .from("institution_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  return !!data;
}

/**
 * Log a builder action for audit purposes.
 */
export async function logBuilderAction(
  supabase: SupabaseClient,
  userId: string,
  action: "create" | "update" | "delete",
  entityType: string,
  entityId: string,
  entityName?: string,
  changes?: Record<string, unknown>,
) {
  await supabase.from("builder_audit_log").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName ?? null,
    changes: changes ?? null,
  });
}
