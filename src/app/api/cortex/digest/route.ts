/**
 * Cortex Weekly Digest API
 *
 * GET /api/cortex/digest — Wöchentlicher Cortex-Bericht
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  isErrorResponse,
  successResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { generateWeeklyDigest } from "@/lib/cortex/digest";

export async function GET(_req: NextRequest) {
  return withErrorHandler("api:cortex:digest", async () => {
    const auth = await requireAuth();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const digest = await generateWeeklyDigest(supabase, user.id);

    return successResponse(digest);
  });
}
