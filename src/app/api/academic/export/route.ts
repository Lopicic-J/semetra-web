/**
 * /api/academic/export — Unified Export API
 *
 * GET ?format=pdf|csv|json[&semester=N]
 *
 * Generates semester reports in the requested format.
 * Reuses /api/academic/semester-report data and adds study metrics.
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
  generateSemesterReportPDF,
  generateSemesterReportCSV,
  generateSemesterReportJSON,
  type SemesterReportData,
  type StudyMetrics,
} from "@/lib/pdf/report-generator";

const log = logger("api:export");

export async function GET(req: NextRequest) {
  return withErrorHandler("api:export", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "pdf";
    const semester = searchParams.get("semester");

    if (!["pdf", "csv", "json"].includes(format)) {
      return errorResponse("Format muss pdf, csv oder json sein", 400);
    }

    // ── Fetch semester report data ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, university, study_program, country, current_semester")
      .eq("id", user.id)
      .single();

    let modulesQuery = supabase
      .from("modules")
      .select("id, name, code, ects, semester, color, status")
      .eq("user_id", user.id);

    if (semester) {
      modulesQuery = modulesQuery.or(
        `semester.eq.${semester},semester.ilike.%${semester}%`
      );
    }

    const { data: modules } = await modulesQuery.order("name");
    const moduleIds = (modules || []).map((m) => m.id);

    // Fetch grades, enrollments, time logs in parallel
    const [gradesRes, enrollmentsRes, timeLogsRes, transfersRes] = await Promise.all([
      moduleIds.length > 0
        ? supabase.from("grades").select("*").eq("user_id", user.id).in("module_id", moduleIds).order("date", { ascending: false })
        : Promise.resolve({ data: [] }),
      moduleIds.length > 0
        ? supabase.from("enrollments").select("id, module_id, status, current_final_grade, current_passed, credits_awarded, normalized_score_0_100, attempts_used")
            .eq("user_id", user.id).in("module_id", moduleIds)
        : Promise.resolve({ data: [] }),
      supabase.from("time_logs").select("module_id, duration_seconds, started_at").eq("user_id", user.id),
      supabase.from("credit_awards").select("*").eq("user_id", user.id).in("award_reason", ["transfer", "recognition", "exemption"]),
    ]);

    const grades = gradesRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const timeLogs = timeLogsRes.data || [];
    const transfers = transfersRes.data || [];

    // Build module reports
    const enrollmentMap = new Map<string, Record<string, unknown>>();
    for (const e of enrollments) {
      enrollmentMap.set(e.module_id as string, e as Record<string, unknown>);
    }

    const gradeMap = new Map<string, Array<Record<string, unknown>>>();
    for (const g of grades) {
      const mid = (g as Record<string, unknown>).module_id as string;
      if (!gradeMap.has(mid)) gradeMap.set(mid, []);
      gradeMap.get(mid)!.push(g as Record<string, unknown>);
    }

    const moduleReports = (modules || []).map((mod) => {
      const modGrades = gradeMap.get(mod.id) || [];
      const enrollment = enrollmentMap.get(mod.id);
      const bestGrade = modGrades.length > 0 ? modGrades[0] : null;

      return {
        module: mod,
        bestGrade: bestGrade
          ? (bestGrade.grade as number | null)
          : (enrollment?.current_final_grade as number | null) || null,
        passed: (enrollment?.current_passed as boolean | null)
          ?? (bestGrade?.grade != null ? true : null),
        ectsEarned: (enrollment?.credits_awarded as number) || mod.ects || 0,
        attempts: (enrollment?.attempts_used as number) || modGrades.length,
        normalizedScore: (enrollment?.normalized_score_0_100 as number) || null,
        grades: modGrades,
        enrollment: enrollment || null,
      };
    });

    // Summary
    const passedModules = moduleReports.filter((r) => r.passed === true);
    const totalEcts = passedModules.reduce((s, r) => s + (r.ectsEarned || 0), 0);
    const transferEcts = transfers.reduce((s, t) =>
      s + ((t.ects_equivalent as number) || (t.credits_awarded_value as number) || 0), 0);
    const gradedModules = moduleReports.filter((r) => r.bestGrade !== null);
    const gpa = gradedModules.length > 0
      ? Math.round(gradedModules.reduce((s, r) => s + (r.bestGrade || 0), 0) / gradedModules.length * 100) / 100
      : null;

    // Study metrics
    const totalSeconds = timeLogs.reduce((s, l) => s + ((l.duration_seconds as number) || 0), 0);
    const MIN_SESSION = 900; // 15 min
    const daySet = new Set<string>();
    for (const l of timeLogs) {
      if ((l.duration_seconds as number) >= MIN_SESSION) {
        daySet.add(new Date(l.started_at as string).toISOString().split("T")[0]);
      }
    }

    // Streak calculation
    const today = new Date().toISOString().split("T")[0];
    const todayDone = daySet.has(today);
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    const d = new Date();
    if (!todayDone) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().split("T")[0];
      if (daySet.has(key)) {
        streak++;
        if (currentStreak === 0 || i < 100) currentStreak = streak;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 0;
      }
      d.setDate(d.getDate() - 1);
    }

    // Top module by time
    const timeByMod: Record<string, number> = {};
    for (const l of timeLogs) {
      const mid = l.module_id as string;
      if (mid) timeByMod[mid] = (timeByMod[mid] || 0) + ((l.duration_seconds as number) || 0);
    }
    const topModId = Object.entries(timeByMod).sort(([, a], [, b]) => b - a)[0]?.[0];
    const topModName = topModId ? (modules || []).find((m) => m.id === topModId)?.name : undefined;

    const studyMetrics: StudyMetrics = {
      totalStudyHours: Math.round(totalSeconds / 3600 * 10) / 10,
      totalSessions: timeLogs.filter((l) => (l.duration_seconds as number) >= MIN_SESSION).length,
      currentStreak,
      longestStreak,
      avgSessionMinutes: timeLogs.length > 0
        ? Math.round(totalSeconds / timeLogs.length / 60)
        : 0,
      topModuleByTime: topModName,
    };

    const reportData: SemesterReportData = {
      profile: {
        name: profile?.full_name || "Student",
        university: profile?.university,
        program: profile?.study_program,
        country: profile?.country,
        semester: semester || profile?.current_semester,
      },
      modules: moduleReports,
      summary: {
        totalModules: moduleReports.length,
        passedModules: passedModules.length,
        failedModules: moduleReports.filter((r) => r.passed === false).length,
        totalEcts,
        transferEcts,
        combinedEcts: totalEcts + transferEcts,
        gpa,
        normalizedAvg: null,
      },
      studyMetrics,
      generatedAt: new Date().toISOString(),
    };

    // ── Generate output ──
    if (format === "pdf") {
      const pdfBytes = await generateSemesterReportPDF(reportData);
      const filename = `Semetra_Report${semester ? `_Semester${semester}` : ""}_${new Date().toISOString().split("T")[0]}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "csv") {
      const csv = generateSemesterReportCSV(reportData);
      const filename = `Semetra_Report${semester ? `_Semester${semester}` : ""}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON
    const json = generateSemesterReportJSON(reportData);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="Semetra_Report_${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  });
}
