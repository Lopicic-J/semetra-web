/**
 * /api/academic/semester-transition — Semester Auto-Reset
 *
 * GET: Check if a transition is pending (returns transition info)
 * POST: Execute the transition (increment semester, archive old modules)
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentSemester, isInTransitionWindow } from "@/lib/semester";
import type { SemesterType } from "@/lib/semester";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_semester, last_semester_type, semester_transition_dismissed_at")
    .eq("id", user.id)
    .single();

  if (!profile?.current_semester) {
    return NextResponse.json({ pending: false });
  }

  const now = new Date();
  const currentPeriod = getCurrentSemester(now);
  const lastType = profile.last_semester_type as SemesterType | null;
  const inWindow = isInTransitionWindow(now);

  // Check if user already dismissed this transition
  if (profile.semester_transition_dismissed_at) {
    const dismissed = new Date(profile.semester_transition_dismissed_at);
    // If dismissed within the current semester period, don't show again
    if (dismissed >= new Date(currentPeriod.startDate)) {
      return NextResponse.json({ pending: false });
    }
  }

  // Transition is pending if: type changed AND we're in the window
  const typeMismatch = lastType && lastType !== currentPeriod.type;
  const pending = typeMismatch && inWindow;

  return NextResponse.json({
    pending,
    currentSemester: profile.current_semester,
    currentPeriod,
    lastType,
    nextSemesterNumber: pending ? profile.current_semester + 1 : null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const action = body.action as "transition" | "dismiss";

  const currentPeriod = getCurrentSemester();

  if (action === "dismiss") {
    await supabase
      .from("profiles")
      .update({
        semester_transition_dismissed_at: new Date().toISOString(),
        last_semester_type: currentPeriod.type,
      })
      .eq("id", user.id);
    return NextResponse.json({ ok: true });
  }

  // Execute transition
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_semester")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const newSemesterNum = profile.current_semester + 1;

  // 1. Archive completed modules from previous semester (soft-hide)
  const { data: completedModules } = await supabase
    .from("modules")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .is("hidden_at", null);

  if (completedModules && completedModules.length > 0) {
    const ids = completedModules.map((m) => m.id);
    await supabase
      .from("modules")
      .update({ hidden_at: new Date().toISOString() })
      .in("id", ids);
  }

  // 2. Update profile with new semester
  await supabase
    .from("profiles")
    .update({
      current_semester: newSemesterNum,
      last_semester_type: currentPeriod.type,
      semester_transition_dismissed_at: null,
      // Reset module import flag so new semester modules get imported
      institution_modules_loaded: false,
    })
    .eq("id", user.id);

  return NextResponse.json({
    ok: true,
    previousSemester: profile.current_semester,
    newSemester: newSemesterNum,
    archivedModules: completedModules?.length ?? 0,
    period: currentPeriod,
  });
}
