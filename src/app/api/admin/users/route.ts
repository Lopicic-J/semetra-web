import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  isErrorResponse,
  successResponse,
  errorResponse,
  parseBody,
  createServiceClient,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/api-helpers";

const log = logger("api:admin-users");

/** Email that can NEVER be modified by institution admins */
const SUPER_ADMIN_EMAIL = "support@semetra.ch";

/**
 * GET /api/admin/users?q=search
 *
 * Platform admin: sees ALL users.
 * Institution admin: sees only users whose institution_id matches
 *   one of the institutions they manage.
 *
 * Returns plan & role info for each user.
 */
export async function GET(request: NextRequest) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? createServiceClient();
    const searchQuery = request.nextUrl.searchParams.get("q");
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "15", 10)));
    const isPlatformAdmin = rc.userRole === "admin";

    // If institution admin, first find which institutions they manage
    let managedInstitutionIds: string[] = [];
    if (!isPlatformAdmin) {
      const { data: assignments } = await db
        .from("institution_admins")
        .select("institution_id")
        .eq("user_id", rc.user.id);
      managedInstitutionIds = (assignments || []).map(
        (a: { institution_id: string }) => a.institution_id
      );

      if (managedInstitutionIds.length === 0) {
        return successResponse({ users: [], role: "institution", institutions: [] });
      }
    }

    let query = db.from("profiles").select(
      "id, email, full_name, username, user_role, verification_status, plan, plan_type, plan_tier, stripe_subscription_status, plan_expires_at, created_at, institution_id, last_seen_at",
      { count: "exact" }
    );

    // Institution admin: filter to only their institution's users
    if (!isPlatformAdmin) {
      query = query.in("institution_id", managedInstitutionIds);
    }

    // Apply search filter
    if (searchQuery) {
      query = query.or(
        `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: users, error, count } = await query
      .order("email", { ascending: true })
      .range(from, to);

    if (error) {
      log.error("Failed to fetch users", { error });
      return errorResponse(error.message, 500);
    }

    // Fetch institution names for context
    let institutionNames: Record<string, string> = {};
    if (!isPlatformAdmin && managedInstitutionIds.length > 0) {
      const { data: insts } = await db
        .from("institutions")
        .select("id, name")
        .in("id", managedInstitutionIds);
      institutionNames = Object.fromEntries(
        (insts || []).map((i: { id: string; name: string }) => [i.id, i.name])
      );
    }

    const total = count ?? 0;

    return successResponse({
      users: (users || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        username: u.username,
        user_role: (u.user_role as UserRole) ?? "non_student",
        verification_status: u.verification_status ?? "none",
        plan: u.plan ?? "free",
        plan_type: u.plan_type ?? null,
        plan_tier: u.plan_tier ?? null,
        stripe_subscription_status: u.stripe_subscription_status ?? null,
        plan_expires_at: u.plan_expires_at ?? null,
        created_at: u.created_at ?? null,
        institution_id: u.institution_id ?? null,
        last_seen_at: u.last_seen_at ?? null,
      })),
      role: rc.userRole,
      institutions: institutionNames,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    log.error("GET /api/admin/users failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}

interface UpdateUserBody {
  user_id: string;
  user_role?: UserRole;
  plan?: "free" | "pro";
  plan_type?: "free" | "subscription" | "lifetime" | null;
  plan_tier?: "basic" | "full" | null;
  plan_expires_at?: string | null;
}

/**
 * PATCH /api/admin/users
 *
 * Platform admin: can update any field for any user.
 * Institution admin:
 *   - Can only modify users in their institution
 *   - Cannot modify support@semetra.ch
 *   - Can only set roles: "institution", "student"
 *   - Can only set plans: "free" or "pro" with plan_type="lifetime", plan_tier="full"
 */
export async function PATCH(request: Request) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? createServiceClient();
    const { user } = rc;
    const isPlatformAdmin = rc.userRole === "admin";

    const body = await parseBody<UpdateUserBody>(request);
    if (isErrorResponse(body)) return body;

    const { user_id, user_role, plan, plan_type, plan_tier, plan_expires_at } = body;

    if (!user_id) {
      return errorResponse("user_id is required", 400);
    }

    // ── Institution admin restrictions ──
    if (!isPlatformAdmin) {
      // 1) Fetch the target user to check institution + email
      const { data: targetUser } = await db
        .from("profiles")
        .select("email, institution_id")
        .eq("id", user_id)
        .single();

      if (!targetUser) {
        return errorResponse("User nicht gefunden", 404);
      }

      // 2) Cannot modify super admin
      if (targetUser.email === SUPER_ADMIN_EMAIL) {
        return errorResponse("Dieser Account kann nicht geändert werden", 403);
      }

      // 3) Must be in one of the institution admin's managed institutions
      const { data: assignments } = await db
        .from("institution_admins")
        .select("institution_id")
        .eq("user_id", user.id);
      const managedIds = new Set(
        (assignments || []).map((a: { institution_id: string }) => a.institution_id)
      );

      if (!targetUser.institution_id || !managedIds.has(targetUser.institution_id)) {
        return errorResponse("Keine Berechtigung für diesen Benutzer", 403);
      }

      // 4) Role restriction: institution admin can only assign "institution" or "student"
      if (user_role !== undefined) {
        const allowedRoles: UserRole[] = ["institution", "student"];
        if (!allowedRoles.includes(user_role)) {
          return errorResponse("Institutions-Admins können nur die Rollen 'Institution' und 'Student' vergeben", 403);
        }
      }

      // 5) Plan restriction: only free or pro lifetime full
      if (plan !== undefined && plan === "pro") {
        // Force lifetime full for institution admins
        if (plan_type !== undefined && plan_type !== "lifetime") {
          return errorResponse("Institutions-Admins können nur Lifetime-Pläne vergeben", 403);
        }
        if (plan_tier !== undefined && plan_tier !== "full") {
          return errorResponse("Institutions-Admins können nur den Full-Plan vergeben", 403);
        }
      }
    }

    // ── Build update object ──
    const updates: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    // Role update
    if (user_role !== undefined) {
      if (isPlatformAdmin) {
        const validRoles: UserRole[] = ["admin", "institution", "student", "non_student"];
        if (!validRoles.includes(user_role)) {
          return errorResponse("Invalid user_role", 400);
        }
      }
      updates.user_role = user_role;
      changes.user_role = user_role;
    }

    // Plan updates
    if (plan !== undefined) {
      if (!["free", "pro"].includes(plan)) {
        return errorResponse("Invalid plan — must be 'free' or 'pro'", 400);
      }
      updates.plan = plan;
      changes.plan = plan;
    }

    if (plan_type !== undefined) {
      const validPlanTypes = ["free", "subscription", "lifetime", null];
      if (!validPlanTypes.includes(plan_type)) {
        return errorResponse("Invalid plan_type", 400);
      }
      updates.plan_type = plan_type;
      changes.plan_type = plan_type;
    }

    if (plan_tier !== undefined) {
      const validTiers = ["basic", "full", null];
      if (!validTiers.includes(plan_tier)) {
        return errorResponse("Invalid plan_tier", 400);
      }
      updates.plan_tier = plan_tier;
      changes.plan_tier = plan_tier;
    }

    if (plan_expires_at !== undefined) {
      updates.plan_expires_at = plan_expires_at;
      changes.plan_expires_at = plan_expires_at;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("No fields to update", 400);
    }

    // Update profile
    const { error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", user_id);

    if (error) {
      log.error("Failed to update user", { error, user_id, updates });
      return errorResponse(error.message, 500);
    }

    // Log the action
    try {
      await db.from("builder_audit_log").insert({
        user_id: user.id,
        action: "update",
        entity_type: "user",
        entity_id: user_id,
        entity_name: null,
        changes: { ...changes, updatedBy: rc.userRole },
      });
    } catch (logErr) {
      log.warn("Failed to log action", logErr);
    }

    return successResponse({
      success: true,
      message: "User updated",
    });
  } catch (err: unknown) {
    log.error("PATCH /api/admin/users failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
