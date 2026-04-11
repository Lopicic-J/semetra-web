import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  isErrorResponse,
  errorResponse,
  createServiceClient,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:email-domains");

/**
 * GET /api/admin/email-domains
 *
 * List email domains. Optional ?institution_id= filter.
 * Platform admin sees all, institution admin sees only their own.
 */
export async function GET(req: NextRequest) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const { searchParams } = new URL(req.url);
    const filterInstitutionId = searchParams.get("institution_id");

    let query = db
      .from("institution_email_domains")
      .select("id, domain, institution_id, created_at, created_by, institutions(id, name, code)")
      .order("domain");

    if (filterInstitutionId) {
      query = query.eq("institution_id", filterInstitutionId);
    }

    // Institution admins: restrict to their institutions
    if (userRole === "institution") {
      const { data: assignments } = await db
        .from("institution_admins")
        .select("institution_id")
        .eq("user_id", user.id);
      const ids = (assignments || []).map((a: { institution_id: string }) => a.institution_id);
      if (ids.length === 0) {
        return NextResponse.json({ domains: [] });
      }
      query = query.in("institution_id", ids);
    }

    const { data, error } = await query;

    if (error) {
      log.error("GET failed", { error });
      return errorResponse(error.message, 500);
    }

    // Normalize the join result
    const domains = (data || []).map((d: Record<string, unknown>) => {
      const inst = d.institutions as Record<string, unknown> | null;
      return {
        id: d.id,
        domain: d.domain,
        institution_id: d.institution_id,
        institution_name: inst?.name || null,
        institution_code: inst?.code || null,
        created_at: d.created_at,
      };
    });

    return NextResponse.json({ domains });
  } catch (err) {
    log.error("GET failed", { error: err });
    return errorResponse("Interner Fehler", 500);
  }
}

/**
 * POST /api/admin/email-domains
 *
 * Add a new email domain to an institution.
 * Body: { institution_id, domain }
 */
export async function POST(req: NextRequest) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const body = await req.json();
    const { institution_id, domain } = body;

    if (!institution_id || !domain) {
      return errorResponse("institution_id und domain sind erforderlich", 400);
    }

    // Normalize domain: lowercase, trim, remove leading @
    const normalizedDomain = domain.toLowerCase().trim().replace(/^@/, "");

    // Basic domain format validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(normalizedDomain)) {
      return errorResponse("Ungültiges Domain-Format (z.B. students.ffhs.ch)", 400);
    }

    // Institution admin: check they manage this institution
    if (userRole === "institution") {
      const { data: assignment } = await db
        .from("institution_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("institution_id", institution_id)
        .single();
      if (!assignment) {
        return errorResponse("Keine Berechtigung für diese Institution", 403);
      }
    }

    // Check institution exists
    const { data: inst } = await db
      .from("institutions")
      .select("id, name")
      .eq("id", institution_id)
      .single();
    if (!inst) {
      return errorResponse("Institution nicht gefunden", 404);
    }

    // Insert
    const { data, error } = await db
      .from("institution_email_domains")
      .insert({
        institution_id,
        domain: normalizedDomain,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorResponse(`Domain "${normalizedDomain}" ist bereits hinterlegt`, 409);
      }
      log.error("POST insert failed", { error });
      return errorResponse(error.message, 500);
    }

    log.info("Domain added", { domain: normalizedDomain, institution_id, by: user.id });

    return NextResponse.json({ domain: data }, { status: 201 });
  } catch (err) {
    log.error("POST failed", { error: err });
    return errorResponse("Interner Fehler", 500);
  }
}

/**
 * DELETE /api/admin/email-domains
 *
 * Remove an email domain.
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const rc = await requireRole(["admin", "institution"]);
    if (isErrorResponse(rc)) return rc;
    const { user, userRole } = rc;
    const db = rc.adminClient ?? createServiceClient();

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return errorResponse("id ist erforderlich", 400);
    }

    // Fetch the domain to check permissions
    const { data: existing } = await db
      .from("institution_email_domains")
      .select("id, domain, institution_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return errorResponse("Domain nicht gefunden", 404);
    }

    // Institution admin: check they manage this institution
    if (userRole === "institution") {
      const { data: assignment } = await db
        .from("institution_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("institution_id", existing.institution_id)
        .single();
      if (!assignment) {
        return errorResponse("Keine Berechtigung", 403);
      }
    }

    const { error } = await db
      .from("institution_email_domains")
      .delete()
      .eq("id", id);

    if (error) {
      log.error("DELETE failed", { error });
      return errorResponse(error.message, 500);
    }

    log.info("Domain removed", { domain: existing.domain, by: user.id });

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("DELETE failed", { error: err });
    return errorResponse("Interner Fehler", 500);
  }
}
