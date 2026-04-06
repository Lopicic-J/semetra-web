import { NextResponse } from "next/server";
import {
  requireRole,
  isErrorResponse,
  successResponse,
  errorResponse,
  createServiceClient,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:admin-stats");

/** Active = last_seen_at within last 15 minutes */
const ACTIVE_THRESHOLD_MIN = 15;

/**
 * GET /api/admin/stats
 *
 * Platform admin: global stats + institution breakdown.
 * Institution admin: stats scoped to their managed institutions.
 */
export async function GET() {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;

    const db = rc.adminClient ?? createServiceClient();
    const isPlatformAdmin = rc.userRole === "admin";
    const activeThreshold = new Date(Date.now() - ACTIVE_THRESHOLD_MIN * 60 * 1000).toISOString();

    if (isPlatformAdmin) {
      // ── Platform admin: full stats + institution breakdown ──
      const [
        { count: userCount },
        { count: institutionCount },
        { count: programCount },
        { count: moduleCount },
        { count: proCount },
        { count: lifetimeCount },
        { count: subscriptionCount },
        { count: activeCount },
        { data: institutionsRaw },
      ] = await Promise.all([
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("institutions").select("*", { count: "exact", head: true }),
        db.from("programs").select("*", { count: "exact", head: true }),
        db.from("modules").select("*", { count: "exact", head: true }),
        db.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
        db.from("profiles").select("*", { count: "exact", head: true }).eq("plan_type", "lifetime"),
        db.from("profiles").select("*", { count: "exact", head: true }).eq("plan_type", "subscription"),
        db.from("profiles").select("*", { count: "exact", head: true }).gte("last_seen_at", activeThreshold),
        db.from("institutions").select("id, name"),
      ]);

      // For each institution, get student count + institution-admin count
      const institutions = institutionsRaw || [];
      const instIds = institutions.map((i: { id: string }) => i.id);

      let institutionDetails: {
        id: string;
        name: string;
        studentCount: number;
        adminCount: number;
        activeCount: number;
      }[] = [];

      if (instIds.length > 0) {
        // Get all profiles with institution_id in one query
        const { data: allInstProfiles } = await db
          .from("profiles")
          .select("institution_id, user_role, last_seen_at")
          .in("institution_id", instIds);

        // Get all institution_admin assignments
        const { data: allAdminAssignments } = await db
          .from("institution_admins")
          .select("institution_id");

        const profilesByInst = new Map<string, { students: number; active: number }>();
        const adminsByInst = new Map<string, number>();

        for (const p of allInstProfiles || []) {
          const iid = p.institution_id as string;
          if (!profilesByInst.has(iid)) profilesByInst.set(iid, { students: 0, active: 0 });
          const entry = profilesByInst.get(iid)!;
          entry.students++;
          if (p.last_seen_at && new Date(p.last_seen_at as string) >= new Date(activeThreshold)) {
            entry.active++;
          }
        }

        for (const a of allAdminAssignments || []) {
          const iid = a.institution_id as string;
          adminsByInst.set(iid, (adminsByInst.get(iid) || 0) + 1);
        }

        institutionDetails = institutions.map((inst: { id: string; name: string }) => ({
          id: inst.id,
          name: inst.name,
          studentCount: profilesByInst.get(inst.id)?.students ?? 0,
          adminCount: adminsByInst.get(inst.id) ?? 0,
          activeCount: profilesByInst.get(inst.id)?.active ?? 0,
        }));

        // Sort by student count descending
        institutionDetails.sort((a, b) => b.studentCount - a.studentCount);
      }

      return successResponse({
        total_users: userCount ?? 0,
        total_institutions: institutionCount ?? 0,
        total_programs: programCount ?? 0,
        total_modules: moduleCount ?? 0,
        pro_users: proCount ?? 0,
        lifetime_users: lifetimeCount ?? 0,
        subscription_users: subscriptionCount ?? 0,
        active_users: activeCount ?? 0,
        institution_details: institutionDetails,
        role: "admin",
      });
    } else {
      // ── Institution admin: scoped stats ──
      const { data: assignments } = await db
        .from("institution_admins")
        .select("institution_id")
        .eq("user_id", rc.user.id);
      const managedIds = (assignments || []).map(
        (a: { institution_id: string }) => a.institution_id
      );

      if (managedIds.length === 0) {
        return successResponse({
          total_users: 0,
          total_programs: 0,
          pro_users: 0,
          active_users: 0,
          role: "institution",
          institution_names: [],
        });
      }

      const [
        { count: userCount },
        { count: programCount },
        { count: proCount },
        { count: activeCount },
        { data: insts },
      ] = await Promise.all([
        db.from("profiles").select("*", { count: "exact", head: true }).in("institution_id", managedIds),
        db.from("programs").select("*", { count: "exact", head: true }).in("institution_id", managedIds),
        db.from("profiles").select("*", { count: "exact", head: true }).in("institution_id", managedIds).eq("plan", "pro"),
        db.from("profiles").select("*", { count: "exact", head: true }).in("institution_id", managedIds).gte("last_seen_at", activeThreshold),
        db.from("institutions").select("id, name").in("id", managedIds),
      ]);

      return successResponse({
        total_users: userCount ?? 0,
        total_programs: programCount ?? 0,
        pro_users: proCount ?? 0,
        active_users: activeCount ?? 0,
        role: "institution",
        institution_names: (insts || []).map((i: { name: string }) => i.name),
      });
    }
  } catch (err: unknown) {
    log.error("GET /api/admin/stats failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500
    );
  }
}
