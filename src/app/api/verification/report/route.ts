/**
 * /api/verification/report — Report Hash Verification API
 *
 * POST — Store a new report hash after generation
 * GET  ?report_id=XXXX-XXXX-XXXX — Verify a report by its ID
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
import {
  generateReportHash,
  type ReportHashInput,
  type VerificationResult,
} from "@/lib/verification/hash";
import { createClient } from "@supabase/supabase-js";

const log = logger("api:verification:report");

// ── GET: Verify a report (public — no auth required) ──────────────────────

export async function GET(req: NextRequest) {
  return withErrorHandler("api:verification:report", async () => {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("report_id");

    if (!reportId) {
      return errorResponse("report_id Parameter ist erforderlich", 400);
    }

    // Use service role for public verification lookups
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("report_verifications")
      .select(`
        id,
        report_id,
        report_type,
        hash,
        generated_at,
        user_id,
        verified_count,
        profiles!report_verifications_user_id_fkey (
          full_name,
          university
        )
      `)
      .eq("report_id", reportId)
      .single();

    if (error || !data) {
      const result: VerificationResult = {
        valid: false,
        reportId,
        reportType: "unknown",
        generatedAt: "",
      };
      return successResponse(result);
    }

    // Increment verified_count
    await supabase
      .from("report_verifications")
      .update({
        verified_count: (data.verified_count ?? 0) + 1,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    const result: VerificationResult = {
      valid: true,
      reportId: data.report_id,
      reportType: data.report_type,
      generatedAt: data.generated_at,
      userName: profile?.full_name ?? undefined,
      university: profile?.university ?? undefined,
      verifiedAt: new Date().toISOString(),
    };

    return successResponse(result);
  });
}

// ── POST: Store a new report hash (auth required) ─────────────────────────

interface StoreHashBody {
  reportId: string;
  reportType: "semester-report" | "module-certificate";
  contentJson: string;
  generatedAt: string;
}

export async function POST(req: NextRequest) {
  return withErrorHandler("api:verification:report", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<StoreHashBody>(req);
    if (isErrorResponse(body)) return body;

    const { reportId, reportType, contentJson, generatedAt } = body;

    if (!reportId || !reportType || !contentJson || !generatedAt) {
      return errorResponse("Alle Felder sind erforderlich", 400);
    }

    // Generate hash
    const hashInput: ReportHashInput = {
      reportId,
      userId: user.id,
      reportType,
      contentJson,
      generatedAt,
    };
    const hash = await generateReportHash(hashInput);

    // Store in DB
    const { error } = await supabase.from("report_verifications").upsert(
      {
        report_id: reportId,
        user_id: user.id,
        report_type: reportType,
        hash,
        content_snapshot: contentJson,
        generated_at: generatedAt,
        created_at: new Date().toISOString(),
      },
      { onConflict: "report_id" }
    );

    if (error) {
      log.error("Failed to store report hash", error);
      return errorResponse("Hash konnte nicht gespeichert werden", 500);
    }

    log.info(`Report hash stored: ${reportId} (${reportType}) for user ${user.id}`);

    return successResponse({
      reportId,
      hash,
      verifyUrl: `https://app.semetra.ch/verify/${reportId}`,
    });
  });
}
