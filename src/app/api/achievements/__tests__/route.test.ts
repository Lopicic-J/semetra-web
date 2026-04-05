/**
 * Tests for /api/achievements
 *
 * Tests achievement fetching, unlocking, and progress tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET, POST } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, parseResponse, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/achievements", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/achievements");
    const res = await GET();

    const { status, json } = await parseResponse(res);
    expect(status).toBe(401);
    expect(json.error).toContain("Nicht autorisiert");
  });

  it("sollte leere Achievements-Liste zurückgeben wenn keine vorhanden", async () => {
    mockSupabase._setTableData("achievement_definitions", []);
    mockSupabase._setTableData("user_achievements", []);
    mockSupabase._setTableData("profiles", {
      xp_total: 0,
      level: 1,
    });

    const req = createTestRequest("/api/achievements");
    const res = await GET();

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("achievements");
    expect(json.achievements).toEqual([]);
    expect(json.xp).toBe(0);
    expect(json.level).toBe(1);
    expect(json.unlockedCount).toBe(0);
    expect(json.totalCount).toBe(0);
  });

  it("sollte Achievements mit Benutzer-Fortschritt zusammenführen", async () => {
    const achievements = [
      sampleData.achievement({ id: "ach-1", name: "First Grade" }),
      sampleData.achievement({ id: "ach-2", name: "Grade Expert" }),
    ];

    const userAchievements = [
      sampleData.userAchievement({ achievement_id: "ach-1", unlocked_at: "2024-01-15T10:00:00Z" }),
    ];

    mockSupabase._setTableData("achievement_definitions", achievements);
    mockSupabase._setTableData("user_achievements", userAchievements);
    mockSupabase._setTableData("profiles", {
      xp_total: 250,
      level: 3,
    });

    const req = createTestRequest("/api/achievements");
    const res = await GET();

    const json = await expectSuccess(res);
    expect(json.achievements).toHaveLength(2);
    expect(json.achievements[0].unlocked).toBe(true);
    expect(json.achievements[1].unlocked).toBe(false);
    expect(json.unlockedCount).toBe(1);
    expect(json.totalCount).toBe(2);
    expect(json.xp).toBe(250);
    expect(json.level).toBe(3);
  });

  it("sollte XP-Schwellen für Level korrekt berechnen", async () => {
    mockSupabase._setTableData("achievement_definitions", []);
    mockSupabase._setTableData("user_achievements", []);
    mockSupabase._setTableData("profiles", {
      xp_total: 400,
      level: 3,
    });

    const req = createTestRequest("/api/achievements");
    const res = await GET();

    const json = await expectSuccess(res);
    // Level 3: (3-1)^2 * 100 = 400 current, 3^2 * 100 = 900 next
    expect(json.currentLevelXp).toBe(400);
    expect(json.nextLevelXp).toBe(900);
  });
});

describe("POST /api/achievements", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "grade" },
    });
    const res = await POST(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Achievement-Überprüfung mit leerer Liste durchführen", async () => {
    mockSupabase._setTableData("grades", []);
    mockSupabase._setTableData("modules", []);
    mockSupabase._setTableData("tasks", []);
    mockSupabase._setTableData("time_logs", []);
    mockSupabase._setTableData("flashcards", []);
    mockSupabase._setTableData("notes", []);

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "grade" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.unlocked).toEqual([]);
    expect(json.count).toBe(0);
  });

  it("sollte Grade-Achievements freischalten basierend auf Anzahl", async () => {
    mockSupabase._setTableData("grades", [
      sampleData.grade({ id: "g1" }),
      sampleData.grade({ id: "g2" }),
      sampleData.grade({ id: "g3" }),
      sampleData.grade({ id: "g4" }),
      sampleData.grade({ id: "g5" }),
    ]);

    // Mock RPC calls for achievement unlocking
    let rpcCalls: any[] = [];
    mockSupabase.rpc.mockImplementation(async (name: string, params: any) => {
      rpcCalls.push({ name, params });
      // Simulate successful unlock
      return { data: true, error: null };
    });

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "grade" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.unlocked).toContain("grade_first");
    expect(json.count).toBeGreaterThanOrEqual(1);
  });

  it("sollte Modul-Achievements beim Erreichen von Schwellen freischalten", async () => {
    mockSupabase._setTableData("modules", Array(10).fill(null).map((_, i) => ({ id: `m${i}`, status: "completed" })));

    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "module" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.unlocked).toEqual(expect.arrayContaining(["module_first", "module_5"]));
  });

  it("sollte Zeit-Achievements nach Stunden-Schwellen freischalten", async () => {
    const timeLogs = Array(30).fill(null).map((_, i) => ({
      duration_seconds: 3600, // 1 hour each
    }));
    mockSupabase._setTableData("time_logs", timeLogs);

    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "time" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.unlocked).toEqual(expect.arrayContaining(["time_10h"]));
  });

  it("sollte 'all' Check-Typ verarbeiten", async () => {
    mockSupabase._setTableData("grades", [sampleData.grade()]);
    mockSupabase._setTableData("modules", []);
    mockSupabase._setTableData("tasks", []);
    mockSupabase._setTableData("time_logs", []);
    mockSupabase._setTableData("flashcards", []);
    mockSupabase._setTableData("notes", []);

    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "all" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(Array.isArray(json.unlocked)).toBe(true);
  });

  it("sollte ungültige Anfrage-Body mit Standardwert verarbeiten", async () => {
    mockSupabase._setTableData("grades", []);
    mockSupabase._setTableData("modules", []);
    mockSupabase._setTableData("tasks", []);
    mockSupabase._setTableData("time_logs", []);
    mockSupabase._setTableData("flashcards", []);
    mockSupabase._setTableData("notes", []);

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: "invalid json",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.count).toBe(0);
  });

  it("sollte Notiz-Achievements freischalten", async () => {
    mockSupabase._setTableData("notes", Array(10).fill(null).map((_, i) => ({ id: `n${i}` })));
    mockSupabase._setTableData("flashcards", []);

    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const req = createTestRequest("/api/achievements", {
      method: "POST",
      body: { check: "learning" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.unlocked).toContain("notes_10");
  });
});
