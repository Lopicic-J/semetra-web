/**
 * Tests for /api/auth/me
 *
 * Tests current user information endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET } from "../me/route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, parseResponse, expectError, expectSuccess } from "@/test/helpers";

describe("GET /api/auth/me", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte aktuellen Benutzer ID und Email zurückgeben", async () => {
    mockSupabase._setUser({
      id: "test-user-id-12345",
      email: "test@semetra.ch",
    });

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("user");
    expect(json.user.id).toBe("test-user-id-12345");
    expect(json.user.email).toBe("test@semetra.ch");
  });

  it("sollte nur ID und Email zurückgeben (nicht alle Metadaten)", async () => {
    mockSupabase._setUser({
      id: "user-1",
      email: "user1@example.com",
      user_metadata: {
        full_name: "User One",
        username: "user1",
      },
      phone: "+41123456789",
    });

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.user).toHaveProperty("id");
    expect(json.user).toHaveProperty("email");
    expect(json.user).not.toHaveProperty("user_metadata");
    expect(json.user).not.toHaveProperty("phone");
  });

  it("sollte verschiedene Benutzer-IDs handhaben", async () => {
    mockSupabase._setUser({
      id: "another-user-uuid",
      email: "another@example.com",
    });

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.user.id).toBe("another-user-uuid");
  });

  it("sollte Fehler bei Supabase-Fehlern handhaben", async () => {
    // Simulate a Supabase error
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Database connection failed" },
    });

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    // Route checks `if (!user)` first → always 401 when user is null
    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte keine Parameter erfordern", async () => {
    mockSupabase._setUser({
      id: "user-1",
      email: "user@example.com",
    });

    const req = createTestRequest("/api/auth/me");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.user.id).toBe("user-1");
  });

  it("sollte Query-Parameter ignorieren", async () => {
    mockSupabase._setUser({
      id: "user-1",
      email: "user@example.com",
    });

    const req = createTestRequest("/api/auth/me?userId=different&format=json");
    const res = await GET(req);

    const json = await expectSuccess(res);
    expect(json.user.id).toBe("user-1");
  });
});
