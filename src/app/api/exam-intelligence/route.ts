/**
 * Exam Intelligence API
 *
 * GET   /api/exam-intelligence               — Dashboard data (exams + risk + predictions + accuracy)
 * POST  /api/exam-intelligence               — Trigger risk snapshots + predictions + recommendations for all exams
 * PATCH /api/exam-intelligence               — Record actual grade (update prediction accuracy)
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

const log = logger("api:exam-intelligence");

// ── GET: Full dashboard data ────────────────────────────────────────────────

export async function GET() {
  return withErrorHandler("api:exam-intelligence", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const { data, error } = await supabase.rpc("get_exam_intelligence", {
      p_user_id: user.id,
    });

    if (error) {
      log.error("get_exam_intelligence failed", error);
      return errorResponse("Prüfungs-Daten konnten nicht geladen werden: " + error.message, 500);
    }

    // Also fetch pending recommendations
    const { data: recommendations } = await supabase
      .from("exam_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    return successResponse({
      ...data,
      recommendations: recommendations ?? [],
    });
  });
}

// ── POST: Refresh all predictions + risk snapshots + recommendations ────────

export async function POST() {
  return withErrorHandler("api:exam-intelligence", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    // Get all upcoming exams
    const { data: exams } = await supabase
      .from("events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_type", "exam")
      .gt("start_dt", new Date().toISOString())
      .order("start_dt", { ascending: true });

    if (!exams || exams.length === 0) {
      return successResponse({ message: "Keine anstehenden Prüfungen", predictions: 0, snapshots: 0, recommendations: 0 });
    }

    let predictions = 0;
    let snapshots = 0;

    // Generate prediction + risk snapshot for each exam
    for (const exam of exams) {
      try {
        const { error: predErr } = await supabase.rpc("record_exam_prediction", {
          p_user_id: user.id,
          p_event_id: exam.id,
        });
        if (!predErr) predictions++;
      } catch {
        log.warn(`Prediction failed for exam ${exam.id}`);
      }

      try {
        const { error: riskErr } = await supabase.rpc("snapshot_exam_risk", {
          p_user_id: user.id,
          p_event_id: exam.id,
        });
        if (!riskErr) snapshots++;
      } catch {
        log.warn(`Risk snapshot failed for exam ${exam.id}`);
      }
    }

    // Generate recommendations
    const { data: recCount } = await supabase.rpc("generate_exam_recommendations", {
      p_user_id: user.id,
    });

    log.info(`Exam intelligence refreshed: ${predictions} predictions, ${snapshots} snapshots, ${recCount ?? 0} recommendations`);

    return successResponse({
      predictions,
      snapshots,
      recommendations: recCount ?? 0,
      exams_processed: exams.length,
    });
  });
}

// ── PATCH: Record actual grade for an exam ──────────────────────────────────

interface PatchBody {
  event_id: string;
  actual_grade: number;
  passed: boolean;
}

export async function PATCH(req: NextRequest) {
  return withErrorHandler("api:exam-intelligence", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await parseBody<PatchBody>(req);
    if (isErrorResponse(body)) return body;

    const { event_id, actual_grade, passed } = body;

    if (!event_id || actual_grade == null || passed == null) {
      return errorResponse("event_id, actual_grade und passed sind erforderlich", 400);
    }

    const { data: updated } = await supabase.rpc("update_prediction_accuracy", {
      p_user_id: user.id,
      p_event_id: event_id,
      p_actual_grade: actual_grade,
      p_passed: passed,
    });

    return successResponse({
      updated_predictions: updated ?? 0,
      message: "Prognose-Genauigkeit aktualisiert",
    });
  });
}
