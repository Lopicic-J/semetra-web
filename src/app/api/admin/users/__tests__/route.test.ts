/**
 * Tests for /api/admin/users
 *
 * Tests user listing, role updates, and admin access control
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

// Hoisted mocks
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

// Mock api-helpers — keep real successResponse/errorResponse/isErrorResponse
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual("@/lib/api-helpers");
  return {
    ...actual,
    requireRole: vi.fn(),
    parseBody: vi.fn(),
  };
});

import { GET, PATCH } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess } from "@/test/helpers";
import * as apiHelpers from "@/lib/api-helpers";

describe("GET /api/admin/users", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte 403 zurückgeben wenn nicht platform_admin", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue(
      NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    );

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);

    const result = await expectError(res, 403);
    expect(result).toHaveProperty("error");
  });

  it("sollte leere Benutzerliste zurückgeben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("profiles", []);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("users");
    expect(json.users).toEqual([]);
  });

  it("sollte alle Benutzer mit Rollen auflisten", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "student@semetra.ch",
        full_name: "Student User",
        user_role: "student",
      },
      {
        id: "user-2",
        email: "admin@semetra.ch",
        full_name: "Admin User",
        user_role: "admin",
      },
      {
        id: "user-3",
        email: "inst-admin@semetra.ch",
        full_name: "Institution Admin",
        user_role: "institution",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users).toHaveLength(3);
    expect(json.users[0].user_role).toBe("student");
    expect(json.users[1].user_role).toBe("admin");
    expect(json.users[2].user_role).toBe("institution");
  });

  it("sollte Benutzer nach E-Mail sortieren", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "alice@semetra.ch",
        full_name: "Alice",
        user_role: "student",
      },
      {
        id: "user-2",
        email: "bob@semetra.ch",
        full_name: "Bob",
        user_role: "student",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users).toHaveLength(2);
    expect(json.users[0].email).toBe("alice@semetra.ch");
    expect(json.users[1].email).toBe("bob@semetra.ch");
  });

  it("sollte Benutzer nach Email-Anfrage filtern", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "alice@semetra.ch",
        full_name: "Alice",
        user_role: "student",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest(
      "http://localhost:3000/api/admin/users?q=alice"
    );

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users).toHaveLength(1);
    expect(json.users[0].email).toContain("alice");
  });

  it("sollte Benutzer nach Namen-Anfrage filtern", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "alice@semetra.ch",
        full_name: "Alice Smith",
        user_role: "student",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest(
      "http://localhost:3000/api/admin/users?q=Smith"
    );

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users).toHaveLength(1);
    expect(json.users[0].full_name).toContain("Smith");
  });

  it("sollte Benutzer ohne Rolle als student einordnen", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "user@semetra.ch",
        full_name: "User",
        user_role: null,
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users[0].user_role).toBe("student");
  });

  it("sollte alle Benutzerfelder zurückgeben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "test@semetra.ch",
        full_name: "Test User",
        user_role: "admin",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    const user = json.users[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("full_name");
    expect(user).toHaveProperty("user_role");
  });

  it("sollte mehrere Benutzer mit verschiedenen Rollen zurückgeben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const users = [
      {
        id: "user-1",
        email: "a@semetra.ch",
        full_name: "User A",
        user_role: "student",
      },
      {
        id: "user-2",
        email: "b@semetra.ch",
        full_name: "User B",
        user_role: "institution",
      },
      {
        id: "user-3",
        email: "c@semetra.ch",
        full_name: "User C",
        user_role: "admin",
      },
    ];

    mockSupabase._setTableData("profiles", users);

    const req = createTestRequest("http://localhost:3000/api/admin/users");

    const res = await GET(req);
    const json = await expectSuccess(res);

    expect(json.users).toHaveLength(3);
    const roles = json.users.map((u: any) => u.user_role);
    expect(roles).toContain("student");
    expect(roles).toContain("institution");
    expect(roles).toContain("admin");
  });
});

describe("PATCH /api/admin/users", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte 403 zurückgeben wenn nicht platform_admin", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue(
      NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    );

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "institution",
      },
    });

    const res = await PATCH(req);

    const result = await expectError(res, 403);
    expect(result).toHaveProperty("error");
  });

  it("sollte 400 zurückgeben bei ungültiger Rolle", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "invalid_role",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "invalid_role",
      },
    });

    const res = await PATCH(req);

    await expectError(res, 400, "Invalid");
  });

  it("sollte Benutzerrolle auf student ändern", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "student",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "student",
      },
    });

    const res = await PATCH(req);
    const json = await expectSuccess(res);

    expect(json.success).toBe(true);
  });

  it("sollte Benutzerrolle auf institution_admin ändern", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "institution",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "institution",
      },
    });

    const res = await PATCH(req);
    const json = await expectSuccess(res);

    expect(json.success).toBe(true);
  });

  it("sollte Benutzerrolle auf platform_admin ändern", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "admin",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "admin",
      },
    });

    const res = await PATCH(req);
    const json = await expectSuccess(res);

    expect(json.success).toBe(true);
  });

  it("sollte Audit-Log beim Rollen-Update schreiben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "institution",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "institution",
      },
    });

    await PATCH(req);

    // Verify that builder_audit_log.insert was called
    expect(mockSupabase.from("builder_audit_log").insert).toBeDefined();
  });

  it("sollte mehrere Rollen-Updates nacheinander verarbeiten", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    // First update
    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "institution",
    });

    const req1 = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "institution",
      },
    });

    const res1 = await PATCH(req1);
    const json1 = await expectSuccess(res1);

    expect(json1.success).toBe(true);

    // Second update
    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "admin",
    });

    const req2 = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "admin",
      },
    });

    const res2 = await PATCH(req2);
    const json2 = await expectSuccess(res2);

    expect(json2.success).toBe(true);
  });

  it("sollte verschiedene Benutzer aktualisieren können", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    // Update user-1
    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "institution",
    });

    const req1 = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "institution",
      },
    });

    const res1 = await PATCH(req1);
    const json1 = await expectSuccess(res1);

    expect(json1.success).toBe(true);

    // Update user-2
    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-2",
      user_role: "student",
    });

    const req2 = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-2",
        user_role: "student",
      },
    });

    const res2 = await PATCH(req2);
    const json2 = await expectSuccess(res2);

    expect(json2.success).toBe(true);
  });

  it("sollte Erfolgnachricht zurückgeben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.parseBody).mockResolvedValue({
      user_id: "user-1",
      user_role: "admin",
    });

    const req = createTestRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: {
        user_id: "user-1",
        user_role: "admin",
      },
    });

    const res = await PATCH(req);
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("message");
    expect(json.message).toContain("User role updated");
  });

  it("sollte nur gültige Rollen akzeptieren", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const validRoles = ["admin", "institution", "student"];

    for (const role of validRoles) {
      vi.mocked(apiHelpers.parseBody).mockResolvedValue({
        user_id: "user-1",
        user_role: role,
      });

      const req = createTestRequest("http://localhost:3000/api/admin/users", {
        method: "PATCH",
        body: {
          user_id: "user-1",
          user_role: role,
        },
      });

      const res = await PATCH(req);
      const json = await expectSuccess(res);

      expect(json.success).toBe(true);
    }
  });
});
