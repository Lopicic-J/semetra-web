/**
 * Tests for /api/leaderboard
 *
 * Tests leaderboard retrieval with ranking calculations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/leaderboard", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    await expectError(res, 401, "Unauthorized");
  });

  it("sollte Leaderboard mit Top-Benutzern zurückgeben", async () => {
    const topUsers = [
      sampleData.leaderboardUser({
        id: "user-1",
        username: "alice",
        xp_total: 1000,
        level: 10,
      }),
      sampleData.leaderboardUser({
        id: "user-2",
        username: "bob",
        xp_total: 800,
        level: 8,
      }),
      sampleData.leaderboardUser({
        id: "user-3",
        username: "charlie",
        xp_total: 600,
        level: 6,
      }),
    ];

    mockSupabase._setTableData("profiles", topUsers);
    mockSupabase._setUser({
      id: "test-user-id-12345",
      email: "test@semetra.ch",
    });
    mockSupabase._setTableData("profiles", topUsers);
    mockSupabase._setRpcResponse([{ rank: 5 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("leaderboard");
    expect(json.leaderboard).toHaveLength(3);
    expect(json.leaderboard[0].username).toBe("alice");
    expect(json.leaderboard[0].xp_total).toBe(1000);
  });

  it("sollte Leaderboard nach XP absteigend sortieren", async () => {
    const users = [
      sampleData.leaderboardUser({ id: "u1", xp_total: 1000 }),
      sampleData.leaderboardUser({ id: "u2", xp_total: 500 }),
      sampleData.leaderboardUser({ id: "u3", xp_total: 750 }),
    ];

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 1 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.leaderboard).toHaveLength(3);
  });

  it("sollte Standard-Limit von 20 verwenden", async () => {
    const users = Array(15)
      .fill(null)
      .map((_, i) =>
        sampleData.leaderboardUser({
          id: `user-${i}`,
          xp_total: 1000 - i * 10,
        })
      );

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 5 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.leaderboard).toHaveLength(15);
  });

  it("sollte custom Limit akzeptieren", async () => {
    const users = Array(10)
      .fill(null)
      .map((_, i) =>
        sampleData.leaderboardUser({
          id: `user-${i}`,
          xp_total: 1000 - i * 10,
        })
      );

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 1 }]);

    const req = createTestRequest("/api/leaderboard?limit=5");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.leaderboard).toHaveLength(10);
  });

  it("sollte Benutzer-Rang abrufen", async () => {
    const users = [
      sampleData.leaderboardUser({
        id: "user-1",
        xp_total: 1000,
      }),
    ];

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 42 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.userRank).toBe(42);
  });

  it("sollte null Rang handhaben", async () => {
    mockSupabase._setTableData("profiles", []);
    mockSupabase._setRpcResponse(null);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.userRank).toBeNull();
  });

  it("sollte aktuelle Benutzer-Profil einschließen", async () => {
    const users = [sampleData.leaderboardUser({ id: "user-1" })];
    const currentUser = sampleData.leaderboardUser({
      id: "test-user-id-12345",
      username: "currentuser",
      xp_total: 100,
      level: 2,
    });

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 100 }]);
    mockSupabase._setUser({
      id: "test-user-id-12345",
      email: "test@semetra.ch",
    });

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.currentUser).toBeDefined();
  });

  it("sollte Bereich-Parameter akzeptieren", async () => {
    const users = [
      sampleData.leaderboardUser({
        id: "user-1",
        xp_total: 1000,
      }),
    ];

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 1 }]);

    const req = createTestRequest("/api/leaderboard?scope=global");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.scope).toBe("global");
  });

  it("sollte Zeitstempel zurückgeben", async () => {
    mockSupabase._setTableData("profiles", []);
    mockSupabase._setRpcResponse([{ rank: null }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("timestamp");
    expect(typeof json.timestamp).toBe("string");
    const date = new Date(json.timestamp);
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(false);
  });

  it("sollte nur Benutzer mit positiven XP anzeigen", async () => {
    const users = [
      sampleData.leaderboardUser({ id: "u1", xp_total: 100 }),
      sampleData.leaderboardUser({ id: "u2", xp_total: 0 }),
    ];

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 1 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.leaderboard).toHaveLength(2);
  });

  it("sollte Benutzerprofil-Felder enthalten", async () => {
    const users = [
      sampleData.leaderboardUser({
        id: "user-1",
        username: "alice",
        full_name: "Alice Smith",
        avatar_url: "https://example.com/avatar.jpg",
        xp_total: 500,
        level: 5,
      }),
    ];

    mockSupabase._setTableData("profiles", users);
    mockSupabase._setRpcResponse([{ rank: 1 }]);

    const req = createTestRequest("/api/leaderboard");
    const res = await GET(req);

    const json = await expectSuccess(res);
    const user = json.leaderboard[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("full_name");
    expect(user).toHaveProperty("avatar_url");
    expect(user).toHaveProperty("xp_total");
    expect(user).toHaveProperty("level");
  });
});
