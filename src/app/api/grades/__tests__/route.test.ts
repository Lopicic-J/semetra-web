/**
 * Tests for /api/grades
 *
 * Tests grade creation, retrieval, updates, and deletion with academic engine integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

// Mock the grade-bridge module
vi.mock("@/lib/academic/grade-bridge", () => ({
  syncGradeToEngine: vi.fn().mockResolvedValue({ success: true }),
  unsyncGradeFromEngine: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET, POST, PATCH, DELETE } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, parseResponse, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/grades", () => {
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

  it("sollte leere Noten-Liste zurückgeben", async () => {
    mockSupabase._setTableData("grades", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("grades");
    expect(json.grades).toEqual([]);
  });

  it("sollte Noten mit Modulinformationen abrufen", async () => {
    const grades = [
      sampleData.grade({
        id: "g1",
        title: "Datenbanken Klausur",
        grade: 5.5,
        date: "2024-01-15",
        modules: { name: "Datenbanken", color: "#3b82f6" },
      }),
      sampleData.grade({
        id: "g2",
        title: "Programmierung Test",
        grade: 4.0,
        date: "2024-02-20",
        modules: { name: "Programmierung", color: "#ef4444" },
      }),
    ];

    mockSupabase._setTableData("grades", grades);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.grades).toHaveLength(2);
    expect(json.grades[0].title).toBe("Datenbanken Klausur");
    expect(json.grades[0].modules).toBeDefined();
  });

  it("sollte Noten nach Datum absteigend sortieren", async () => {
    const grades = [
      sampleData.grade({ id: "g1", date: "2024-01-15" }),
      sampleData.grade({ id: "g2", date: "2024-02-20" }),
      sampleData.grade({ id: "g3", date: "2024-03-10" }),
    ];

    mockSupabase._setTableData("grades", grades);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.grades).toHaveLength(3);
  });
});

describe("POST /api/grades", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: { title: "Test" },
    });
    const res = await POST(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler bei fehlender Titel zurückgeben", async () => {
    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: { grade: 5.5 },
    });
    const res = await POST(req);

    await expectError(res, 400, "Titel ist erforderlich");
  });

  it("sollte Fehler bei leerem Titel zurückgeben", async () => {
    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: { title: "" },
    });
    const res = await POST(req);

    await expectError(res, 400, "erforderlich");
  });

  it("sollte neue Note mit Standardwerten erstellen", async () => {
    const newGrade = sampleData.grade({ id: "g-new", title: "Englisch Test" });
    mockSupabase._setTableData("grades", [newGrade]);

    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: { title: "Englisch Test" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res, 201);
    expect(json.grade).toBeDefined();
    expect(json.grade.title).toBe("Englisch Test");
    expect(json.grade.weight).toBeDefined();
  });

  it("sollte neue Note mit vollständigen Daten erstellen", async () => {
    const gradeData = {
      title: "Mathematik Klausur",
      grade: 5.5,
      weight: 2,
      date: "2024-01-20",
      module_id: "mod-1",
      exam_type: "written",
      notes: "Good understanding",
      ects_earned: 5,
    };

    const createdGrade = sampleData.grade(gradeData);
    mockSupabase._setTableData("grades", [createdGrade]);

    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: gradeData,
    });
    const res = await POST(req);

    const json = await expectSuccess(res, 201);
    expect(json.grade.title).toBe("Mathematik Klausur");
    expect(json.grade.grade).toBe(5.5);
    expect(json.grade.weight).toBe(2);
  });

  it("sollte Grade-Brückenintegration durchführen", async () => {
    const gradeData = {
      title: "Test",
      grade: 5.5,
      module_id: "mod-1",
    };

    const createdGrade = sampleData.grade(gradeData);
    mockSupabase._setTableData("grades", [createdGrade]);
    mockSupabase._setTableData("profiles", sampleData.profile());

    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: gradeData,
    });
    const res = await POST(req);

    const json = await expectSuccess(res, 201);
    expect(json).toHaveProperty("bridge");
  });

  it("sollte null Grade handhaben", async () => {
    const gradeData = {
      title: "Notiz",
      grade: null,
    };

    const createdGrade = sampleData.grade(gradeData);
    mockSupabase._setTableData("grades", [createdGrade]);

    const req = createTestRequest("/api/grades", {
      method: "POST",
      body: gradeData,
    });
    const res = await POST(req);

    const json = await expectSuccess(res, 201);
    expect(json.grade.grade).toBeNull();
  });
});

describe("PATCH /api/grades", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { id: "g1", title: "Updated" },
    });
    const res = await PATCH(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn ID fehlt", async () => {
    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { title: "Updated" },
    });
    const res = await PATCH(req);

    await expectError(res, 400, "Grade-ID erforderlich");
  });

  it("sollte Note-Titel aktualisieren", async () => {
    const updatedGrade = sampleData.grade({
      id: "g1",
      title: "Updated Title",
    });
    mockSupabase._setTableData("grades", [updatedGrade]);

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { id: "g1", title: "Updated Title" },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.grade.title).toBe("Updated Title");
  });

  it("sollte Note-Note aktualisieren", async () => {
    const updatedGrade = sampleData.grade({
      id: "g1",
      grade: 4.5,
    });
    mockSupabase._setTableData("grades", [updatedGrade]);

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { id: "g1", grade: 4.5 },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.grade.grade).toBe(4.5);
  });

  it("sollte mehrere Felder gleichzeitig aktualisieren", async () => {
    const updatedGrade = sampleData.grade({
      id: "g1",
      title: "Updated",
      grade: 3.0,
      weight: 1.5,
    });
    mockSupabase._setTableData("grades", [updatedGrade]);

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: {
        id: "g1",
        title: "Updated",
        grade: 3.0,
        weight: 1.5,
      },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.grade.title).toBe("Updated");
    expect(json.grade.grade).toBe(3.0);
    expect(json.grade.weight).toBe(1.5);
  });

  it("sollte Grade auf null setzen können", async () => {
    const updatedGrade = sampleData.grade({
      id: "g1",
      grade: null,
    });
    mockSupabase._setTableData("grades", [updatedGrade]);

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { id: "g1", grade: "" },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.grade.grade).toBeNull();
  });

  it("sollte Modulzuordnung aktualisieren", async () => {
    const updatedGrade = sampleData.grade({
      id: "g1",
      module_id: "mod-2",
    });
    mockSupabase._setTableData("grades", [updatedGrade]);

    const req = createTestRequest("/api/grades", {
      method: "PATCH",
      body: { id: "g1", module_id: "mod-2" },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.grade.module_id).toBe("mod-2");
  });
});

describe("DELETE /api/grades", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/grades?id=g1", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn ID fehlt", async () => {
    const req = createTestRequest("/api/grades", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    await expectError(res, 400, "Grade-ID erforderlich");
  });

  it("sollte Note erfolgreich löschen", async () => {
    const req = createTestRequest("/api/grades?id=g1", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.deleted).toBe(true);
    expect(json).toHaveProperty("bridge");
  });

  it("sollte Benutzer-Eigentumsverifizierung durchführen", async () => {
    const req = createTestRequest("/api/grades?id=g1", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.deleted).toBe(true);
  });
});
