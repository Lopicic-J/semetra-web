/**
 * Role Select API — post-OAuth/signup role picker
 *
 * POST /api/role-select  { role: "student" | "non_student" }
 * Sets profiles.user_role and profiles.role_confirmed.
 *
 * Dozent/Institution roles are intentionally NOT selectable here —
 * those require a manual support request for verification.
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  successResponse,
  parseBody,
  withErrorHandler,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const log = logger("api:role-select");

type SelectableRole = "student" | "non_student";
const ALLOWED_ROLES: SelectableRole[] = ["student", "non_student"];

interface Body {
  role: SelectableRole;
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:role-select", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<Body>(req);
    if (isErrorResponse(body)) return body;

    if (!body.role || !ALLOWED_ROLES.includes(body.role)) {
      return errorResponse(
        "role muss 'student' oder 'non_student' sein (Dozent/Institution nur via Support)",
        400,
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        user_role: body.role,
        role_confirmed: true,
      })
      .eq("id", user.id);

    if (error) {
      log.error("role-select update failed", error);
      return errorResponse("Rolle konnte nicht gespeichert werden: " + error.message, 500);
    }

    log.info(`Role '${body.role}' set for user ${user.id}`);
    return successResponse({ role: body.role });
  });
}
