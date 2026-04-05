/**
 * Tests for /api/groups
 *
 * Tests study group creation, retrieval, and membership management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET, POST } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, parseResponse, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/groups", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const res = await GET();
    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte leere Gruppen-Liste zurückgeben", async () => {
    mockSupabase._setTableData("study_group_members", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("groups");
    expect(json.groups).toEqual([]);
  });

  it("sollte Gruppen mit Benutzerolle abrufen", async () => {
    const memberships = [
      {
        role: "owner",
        group_id: "group-1",
        study_groups: sampleData.group({
          id: "group-1",
          name: "Semester 1",
        }),
      },
      {
        role: "member",
        group_id: "group-2",
        study_groups: sampleData.group({
          id: "group-2",
          name: "Mathe Study Group",
        }),
      },
    ];

    mockSupabase._setTableData("study_group_members", memberships);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.groups).toHaveLength(2);
    expect(json.groups[0].myRole).toBe("owner");
    expect(json.groups[0].name).toBe("Semester 1");
    expect(json.groups[1].myRole).toBe("member");
  });

  it("sollte Gruppen nach Datum der Mitgliedschaft sortieren", async () => {
    const memberships = [
      {
        role: "member",
        group_id: "group-1",
        joined_at: "2024-01-01T00:00:00Z",
        study_groups: sampleData.group({ id: "group-1" }),
      },
      {
        role: "member",
        group_id: "group-2",
        joined_at: "2024-02-01T00:00:00Z",
        study_groups: sampleData.group({ id: "group-2" }),
      },
    ];

    mockSupabase._setTableData("study_group_members", memberships);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.groups).toHaveLength(2);
  });

  it("sollte Gruppen-Einladungscodes und Besitzer-Info enthalten", async () => {
    const memberships = [
      {
        role: "owner",
        group_id: "group-1",
        study_groups: sampleData.group({
          id: "group-1",
          invite_code: "ABC123DEF",
          owner_id: "test-user-id-12345",
        }),
      },
    ];

    mockSupabase._setTableData("study_group_members", memberships);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.groups[0].invite_code).toBe("ABC123DEF");
    expect(json.groups[0].owner_id).toBe("test-user-id-12345");
  });
});

describe("POST /api/groups", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { name: "New Group" },
    });
    const res = await POST(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn Name fehlt", async () => {
    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { description: "A study group" },
    });
    const res = await POST(req);

    await expectError(res, 400, "Name ist erforderlich");
  });

  it("sollte Fehler zurückgeben wenn Name leer ist", async () => {
    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { name: "   " },
    });
    const res = await POST(req);

    await expectError(res, 400, "erforderlich");
  });

  it("sollte neue Gruppe mit Namen erstellen", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      name: "Informatik Gruppe",
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { name: "Informatik Gruppe" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group).toBeDefined();
    expect(json.group.name).toBe("Informatik Gruppe");
  });

  it("sollte neue Gruppe mit Standardfarbe erstellen", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      color: "#6d28d9",
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { name: "New Group" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group.color).toBe("#6d28d9");
  });

  it("sollte neue Gruppe mit benutzerdefinierten Feldern erstellen", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      name: "Mathe Study Group",
      description: "Mathematics and statistics",
      color: "#ef4444",
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: {
        name: "Mathe Study Group",
        description: "Mathematics and statistics",
        color: "#ef4444",
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group.name).toBe("Mathe Study Group");
    expect(json.group.description).toBe("Mathematics and statistics");
    expect(json.group.color).toBe("#ef4444");
  });

  it("sollte Gruppennamen trimmen", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      name: "Trimmed Name",
      description: "Description",
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: {
        name: "  Trimmed Name  ",
        description: "  Description  ",
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group.name).toBe("Trimmed Name");
    expect(json.group.description).toBe("Description");
  });

  it("sollte Benutzer automatisch als Besitzer hinzufügen", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      owner_id: "test-user-id-12345",
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: { name: "New Group" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group.owner_id).toBe("test-user-id-12345");
  });

  it("sollte null-Beschreibung bei leerer Eingabe speichern", async () => {
    const newGroup = sampleData.group({
      id: "group-new",
      description: null,
    });
    mockSupabase._setTableData("study_groups", [newGroup]);

    const req = createTestRequest("/api/groups", {
      method: "POST",
      body: {
        name: "Group",
        description: null,
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.group.description).toBeNull();
  });
});
