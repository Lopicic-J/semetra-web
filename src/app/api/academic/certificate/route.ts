/**
 * /api/academic/certificate — Module Certificate API
 *
 * GET ?module_id=UUID — Generate a PDF certificate for a completed module
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  errorResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import {
  generateModuleCertificatePDF,
  type CertificateData,
} from "@/lib/pdf/certificate-generator";
import {
  generateReportHash,
  generateReportId,
  type ReportHashInput,
} from "@/lib/verification/hash";

const log = logger("api:certificate");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:certificate", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("module_id");

    if (!moduleId) {
      return errorResponse("module_id ist erforderlich", 400);
    }

    // Fetch module
    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id, name, code, ects, semester, status")
      .eq("id", moduleId)
      .eq("user_id", user.id)
      .single();

    if (modErr || !mod) {
      return errorResponse("Modul nicht gefunden", 404);
    }

    // Fetch enrollment to check completion
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("current_passed, current_final_grade, credits_awarded, status")
      .eq("module_id", moduleId)
      .eq("user_id", user.id)
      .single();

    const passed = enrollment?.current_passed === true ||
      enrollment?.status === "passed";

    if (!passed) {
      return errorResponse(
        "Zertifikate können nur für bestandene Module generiert werden",
        400
      );
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, university, study_program")
      .eq("id", user.id)
      .single();

    const reportId = generateReportId();
    const generatedAt = new Date().toISOString();

    const certData: CertificateData = {
      studentName: profile?.full_name || "Student",
      university: profile?.university,
      program: profile?.study_program,
      moduleName: mod.name,
      moduleCode: mod.code,
      ects: enrollment?.credits_awarded || mod.ects || 0,
      grade: enrollment?.current_final_grade ?? null,
      passed: true,
      completedAt: generatedAt,
      semester: mod.semester,
      reportId,
    };

    // Generate PDF
    const { bytes } = await generateModuleCertificatePDF(certData);

    // Store verification hash
    try {
      const contentJson = JSON.stringify({
        moduleName: mod.name,
        moduleCode: mod.code,
        grade: enrollment?.current_final_grade,
        ects: certData.ects,
        studentName: certData.studentName,
      });

      const hashInput: ReportHashInput = {
        reportId,
        userId: user.id,
        reportType: "module-certificate",
        contentJson,
        generatedAt,
      };
      const hash = await generateReportHash(hashInput);

      await supabase.from("report_verifications").upsert(
        {
          report_id: reportId,
          user_id: user.id,
          report_type: "module-certificate",
          hash,
          content_snapshot: contentJson,
          generated_at: generatedAt,
          created_at: generatedAt,
        },
        { onConflict: "report_id" }
      );
      log.info(`Certificate hash stored: ${reportId} for module ${mod.name}`);
    } catch (hashErr) {
      log.warn("Failed to store certificate hash (non-blocking)", hashErr);
    }

    const filename = `Semetra_Zertifikat_${mod.name.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Semetra-Report-Id": reportId,
        "X-Semetra-Verify-Url": `https://app.semetra.ch/verify/${reportId}`,
      },
    });
  });
}
