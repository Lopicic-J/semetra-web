/**
 * /api/challenges — Study Challenges
 *
 * GET: List active/completed challenges for user
 * POST: Create challenge or join via invite code
 * PATCH: Update progress (called after study sessions)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "active";

  // Get challenges the user participates in
  const { data: participations } = await supabase
    .from("challenge_participants")
    .select("challenge_id, current_value, rank, joined_at")
    .eq("user_id", user.id);

  const challengeIds = (participations ?? []).map(p => p.challenge_id);

  // Get challenge details + all participants for leaderboard
  const orFilter = challengeIds.length > 0
    ? `id.in.(${challengeIds.join(",")}),is_public.eq.true`
    : `is_public.eq.true`;
  const { data: challenges } = await supabase
    .from("challenges")
    .select("*")
    .or(orFilter)
    .eq("status", status)
    .order("ends_at", { ascending: true });

  // Enrich with participants and leaderboard
  const enriched = await Promise.all(
    (challenges ?? []).map(async (ch) => {
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("user_id, current_value, rank, profiles(username, full_name, avatar_url)")
        .eq("challenge_id", ch.id)
        .order("current_value", { ascending: false });

      const userParticipation = participations?.find(p => p.challenge_id === ch.id);
      const leaderboard = (participants ?? []).map((p: any, i: number) => ({
        userId: p.user_id,
        username: p.profiles?.username ?? p.profiles?.full_name ?? "Anonym",
        avatarUrl: p.profiles?.avatar_url,
        value: p.current_value,
        rank: i + 1,
        isCurrentUser: p.user_id === user.id,
      }));

      return {
        ...ch,
        participantCount: leaderboard.length,
        leaderboard: leaderboard.slice(0, 10),
        userProgress: userParticipation?.current_value ?? null,
        userRank: leaderboard.findIndex(l => l.isCurrentUser) + 1 || null,
        isJoined: !!userParticipation,
        isCreator: ch.creator_id === user.id,
        daysLeft: Math.max(0, Math.ceil((new Date(ch.ends_at).getTime() - Date.now()) / 86400000)),
      };
    })
  );

  return NextResponse.json({ challenges: enriched });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === "join") {
    // Join via invite code
    const { inviteCode } = body;
    if (!inviteCode) return NextResponse.json({ error: "inviteCode required" }, { status: 400 });

    const { data: challenge } = await supabase
      .from("challenges")
      .select("id, max_participants, status")
      .eq("invite_code", inviteCode)
      .eq("status", "active")
      .single();

    if (!challenge) return NextResponse.json({ error: "Challenge nicht gefunden oder bereits beendet" }, { status: 404 });

    // Check participant limit
    const { count } = await supabase
      .from("challenge_participants")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challenge.id);

    if (challenge.max_participants && (count ?? 0) >= challenge.max_participants) {
      return NextResponse.json({ error: "Challenge ist voll" }, { status: 409 });
    }

    const { error } = await supabase
      .from("challenge_participants")
      .insert({ challenge_id: challenge.id, user_id: user.id });

    if (error?.code === "23505") {
      return NextResponse.json({ error: "Du nimmst bereits teil" }, { status: 409 });
    }

    return NextResponse.json({ joined: true, challengeId: challenge.id });
  }

  // Create new challenge
  const { title, description, moduleId, challengeType, targetValue, durationDays, isPublic } = body;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const VALID_TYPES = ["study_time", "streak", "tasks_completed", "flashcards_reviewed", "topics_mastered"];
  const validatedType = VALID_TYPES.includes(challengeType) ? challengeType : "study_time";

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + (durationDays ?? 7));

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: user.id,
      title,
      description: description ?? null,
      module_id: moduleId ?? null,
      challenge_type: validatedType,
      target_value: targetValue ?? null,
      ends_at: endsAt.toISOString(),
      is_public: isPublic ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Creator auto-joins
  await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challenge.id, user_id: user.id });

  return NextResponse.json({ challenge, created: true });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { challengeId, incrementBy } = body;

  if (!challengeId || !incrementBy) {
    return NextResponse.json({ error: "challengeId and incrementBy required" }, { status: 400 });
  }

  // Update participant progress
  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id, current_value")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 404 });

  const newValue = (participant.current_value ?? 0) + incrementBy;

  await supabase
    .from("challenge_participants")
    .update({ current_value: newValue, last_updated_at: new Date().toISOString() })
    .eq("id", participant.id);

  return NextResponse.json({ updated: true, newValue });
}
