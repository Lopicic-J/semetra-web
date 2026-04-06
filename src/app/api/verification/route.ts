import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  successResponse,
  errorResponse,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { isUniversityEmail, getEmailDomain } from "@/lib/university-domains";

const log = logger("api:verification");

/**
 * GET /api/verification
 *
 * Get the current user's verification status.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase, user } = auth;

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_role, verification_status, verification_submitted_at, verification_reviewed_at, verification_note, verified_email_domain")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return errorResponse("Profil nicht gefunden", 404);
    }

    return successResponse({ verification: profile });
  } catch (err: unknown) {
    log.error("GET /api/verification failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}

/**
 * POST /api/verification
 *
 * Request verification or re-check email domain.
 * If the user's current email matches a known university domain,
 * they are automatically verified.
 * Otherwise, status is set to "pending" for manual admin review.
 *
 * No document upload needed.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase, user } = auth;

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_role, verification_status, email")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return errorResponse("Profil nicht gefunden", 404);
    }

    // Only student and institution roles can submit verification
    if (!["student", "institution"].includes(profile.user_role)) {
      return errorResponse("Nur Studenten und Institutions-Nutzer können eine Verifizierung einreichen", 400);
    }

    // Already verified
    if (profile.verification_status === "verified") {
      return errorResponse("Bereits verifiziert", 400);
    }

    const email = profile.email || user.email || "";
    const isUniEmail = isUniversityEmail(email);

    const updateData: Record<string, unknown> = {
      verification_submitted_at: new Date().toISOString(),
      verification_note: null, // clear previous rejection note
    };

    if (isUniEmail) {
      // Auto-verify: University email domain recognized
      updateData.verification_status = "verified";
      updateData.verified_email_domain = getEmailDomain(email);
      updateData.verification_reviewed_at = new Date().toISOString();
    } else {
      // Manual review needed
      updateData.verification_status = "pending";
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      log.error("Failed to submit verification", { error });
      return errorResponse(error.message, 500);
    }

    return successResponse({
      success: true,
      autoVerified: isUniEmail,
      message: isUniEmail
        ? "Hochschul-Email erkannt — automatisch verifiziert!"
        : "Verifizierungsantrag eingereicht — wird manuell geprüft.",
    });
  } catch (err: unknown) {
    log.error("POST /api/verification failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}
