/**
 * /api/groups/intelligence — Study Group Analytics
 *
 * GET ?groupId=<uuid>: Group performance analytics
 *   - Per-member study stats
 *   - Common weak topics
 *   - Group study time trends
 *   - Recommended group activities
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

  // Verify membership
  const { data: membership } = await supabase
    .from("study_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Get all members
  const { data: members } = await supabase
    .from("study_group_members")
    .select("user_id, profiles(username, full_name, avatar_url)")
    .eq("group_id", groupId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return NextResponse.json({ error: "No members" }, { status: 404 });

  // Get shared modules (modules that multiple members have)
  const { data: allModules } = await supabase
    .from("modules")
    .select("id, name, user_id, ects")
    .in("user_id", memberIds);

  // Find common modules by name (different users have different module IDs)
  const modulesByName = new Map<string, { name: string; ects: number; userIds: string[]; moduleIds: string[] }>();
  for (const m of (allModules ?? []) as { id: string; name: string; user_id: string; ects: number }[]) {
    const key = m.name.toLowerCase().trim();
    const existing = modulesByName.get(key) ?? { name: m.name, ects: m.ects ?? 0, userIds: [] as string[], moduleIds: [] as string[] };
    existing.userIds.push(m.user_id);
    existing.moduleIds.push(m.id);
    modulesByName.set(key, existing);
  }

  // Common modules = shared by 2+ members
  const commonModules = [...modulesByName.values()]
    .filter((m) => m.userIds.length >= 2)
    .sort((a, b) => b.userIds.length - a.userIds.length);

  // Get study time per member (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: timeLogs } = await supabase
    .from("time_logs")
    .select("user_id, duration_seconds")
    .in("user_id", memberIds)
    .gte("started_at", thirtyDaysAgo.toISOString());

  const studyTimeByMember = new Map<string, number>();
  for (const log of timeLogs ?? []) {
    const current = studyTimeByMember.get(log.user_id) ?? 0;
    studyTimeByMember.set(log.user_id, current + (log.duration_seconds ?? 0));
  }

  // Get weak topics across common modules
  const commonModuleIds = commonModules.flatMap((m) => m.moduleIds);
  const { data: topics } = await supabase
    .from("topics")
    .select("title, knowledge_level, module_id, user_id")
    .in("module_id", commonModuleIds.length > 0 ? commonModuleIds : ["__none__"])
    .lt("knowledge_level", 50);

  // Count topic weakness frequency
  const weakTopicCounts = new Map<string, { title: string; count: number; avgLevel: number; levels: number[] }>();
  for (const t of (topics ?? []) as { title: string; knowledge_level: number | null; module_id: string; user_id: string }[]) {
    const key = t.title.toLowerCase().trim();
    const existing = weakTopicCounts.get(key) ?? { title: t.title, count: 0, avgLevel: 0, levels: [] as number[] };
    existing.count++;
    existing.levels.push(t.knowledge_level ?? 0);
    existing.avgLevel = existing.levels.reduce((s, l) => s + l, 0) / existing.levels.length;
    weakTopicCounts.set(key, existing);
  }

  // Common weak topics = weak for 2+ members
  const commonWeakTopics = [...weakTopicCounts.values()]
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Build member stats
  const memberStats = (members ?? []).map((m: any) => ({
    userId: m.user_id,
    username: m.profiles?.username ?? m.profiles?.full_name ?? "Anonym",
    avatarUrl: m.profiles?.avatar_url,
    studyMinutes30d: Math.round((studyTimeByMember.get(m.user_id) ?? 0) / 60),
    isCurrentUser: m.user_id === user.id,
  })).sort((a, b) => b.studyMinutes30d - a.studyMinutes30d);

  // Group totals
  const totalStudyMinutes = memberStats.reduce((s, m) => s + m.studyMinutes30d, 0);
  const avgStudyMinutes = memberStats.length > 0 ? Math.round(totalStudyMinutes / memberStats.length) : 0;

  // Recommendations
  const recommendations: string[] = [];
  if (commonWeakTopics.length > 0) {
    recommendations.push(`Gemeinsame Lernsession zu "${commonWeakTopics[0].title}" — ${commonWeakTopics[0].count} Mitglieder haben hier Lücken`);
  }
  if (commonModules.length > 0) {
    recommendations.push(`Karteikarten zu "${commonModules[0].name}" teilen — ${commonModules[0].userIds.length} Mitglieder belegen dieses Modul`);
  }
  const lowestStudy = memberStats.filter((m) => !m.isCurrentUser).sort((a, b) => a.studyMinutes30d - b.studyMinutes30d)[0];
  if (lowestStudy && lowestStudy.studyMinutes30d < avgStudyMinutes * 0.5) {
    recommendations.push(`${lowestStudy.username} könnte Unterstützung brauchen — deutlich unter dem Gruppen-Durchschnitt`);
  }

  return NextResponse.json({
    groupId,
    memberCount: memberStats.length,
    members: memberStats,
    commonModules: commonModules.slice(0, 10).map((m) => ({
      name: m.name,
      ects: m.ects,
      sharedBy: m.userIds.length,
    })),
    commonWeakTopics,
    studyTime: {
      totalMinutes: totalStudyMinutes,
      averagePerMember: avgStudyMinutes,
      period: "30 Tage",
    },
    recommendations,
  });
}
