/**
 * Tests for /api/academic/institutions and /api/academic/institutions/[id]
 *
 * Tests institution listing, creation, updates, and deletion with role-based access control
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

// Hoisted mocks - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

// Mock api-helpers — keep real successResponse/errorResponse/isErrorResponse
const mockServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual("@/lib/api-helpers");
  return {
    ...actual,
    requireRole: vi.fn(),
    canManageInstitution: vi.fn(),
    logBuilderAction: vi.fn().mockResolvedValue(undefined),
    createServiceClient: mockServiceClient,
  };
});

import { GET as GET_LIST, POST as POST_CREATE } from "../route";
import {
  GET as GET_BY_ID,
  PATCH as PATCH_BY_ID,
  DELETE as DELETE_BY_ID,
} from "../[id]/route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess, sampleData } from "@/test/helpers";
import * as apiHelpers from "@/lib/api-helpers";

describe("GET /api/academic/institutions", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockServiceClient.mockReturnValue(mockSupabase);
  });

  it("sollte leere Institution-Liste zurückgeben", async () => {
    mockSupabase._setTableData("institutions", []);

    const res = await GET_LIST(
      createTestRequest("http://localhost:3000/api/academic/institutions")
    );
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("institutions");
    expect(json.institutions).toEqual([]);
  });

  it("sollte alle verfügbaren Institutionen auflisten", async () => {
    const institutions = [
      {
        id: "inst-1",
        name: "ETH Zürich",
        country_code: "CH",
        institution_type: "university",
        official_language: "de",
      },
      {
        id: "inst-2",
        name: "University of Bern",
        country_code: "CH",
        institution_type: "university",
        official_language: "de",
      },
    ];

    mockSupabase._setTableData("institutions", institutions);

    const res = await GET_LIST(
      createTestRequest("http://localhost:3000/api/academic/institutions")
    );
    const json = await expectSuccess(res);

    expect(json.institutions).toHaveLength(2);
    expect(json.institutions[0].name).toBe("ETH Zürich");
    expect(json.institutions[1].name).toBe("University of Bern");
  });

  it("sollte nach Ländercode filtern", async () => {
    const institutions = [
      { id: "inst-1", name: "ETH", country_code: "CH" },
      { id: "inst-2", name: "TU Munich", country_code: "DE" },
    ];

    // Mock the query builder to handle filter
    const mockBuilder = createMockSupabase();
    mockBuilder._setTableData("institutions", [
      { id: "inst-1", name: "ETH", country_code: "CH" },
    ]);
    mockCreateClient.mockResolvedValue(mockBuilder);

    const res = await GET_LIST(
      createTestRequest(
        "http://localhost:3000/api/academic/institutions?country=CH"
      )
    );
    const json = await expectSuccess(res);

    expect(json.institutions).toBeDefined();
  });

  it("sollte verschiedene Institution-Typen zurückgeben", async () => {
    const institutions = [
      {
        id: "inst-1",
        name: "ETH Zürich",
        institution_type: "university",
      },
      {
        id: "inst-2",
        name: "FH Zürich",
        institution_type: "university_of_applied_sciences",
      },
      {
        id: "inst-3",
        name: "Gymnasium Freud",
        institution_type: "secondary_school",
      },
    ];

    mockSupabase._setTableData("institutions", institutions);

    const res = await GET_LIST(
      createTestRequest("http://localhost:3000/api/academic/institutions")
    );
    const json = await expectSuccess(res);

    expect(json.institutions).toHaveLength(3);
    expect(json.institutions.map((i: any) => i.institution_type)).toContain(
      "university"
    );
    expect(json.institutions.map((i: any) => i.institution_type)).toContain(
      "university_of_applied_sciences"
    );
  });
});

describe("POST /api/academic/institutions", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockServiceClient.mockReturnValue(mockSupabase);
  });

  it("sollte 403 zurückgeben wenn nicht platform_admin", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue(
      NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    );

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "ETH",
          country_code: "CH",
        },
      }
    );

    const res = await POST_CREATE(req);
    const result = await expectError(res, 403);

    expect(result).toHaveProperty("error");
  });

  it("sollte 400 zurückgeben wenn Name fehlt", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          country_code: "CH",
        },
      }
    );

    const res = await POST_CREATE(req);
    await expectError(res, 400, "erforderlich");
  });

  it("sollte 400 zurückgeben wenn Ländercode fehlt", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "ETH Zürich",
        },
      }
    );

    const res = await POST_CREATE(req);
    await expectError(res, 400, "erforderlich");
  });

  it("sollte 400 zurückgeben bei ungültigem Ländercode", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("country_systems", [], {
      code: "PGRST116",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "ETH Zürich",
          country_code: "XX",
        },
      }
    );

    const res = await POST_CREATE(req);
    await expectError(res, 400, "Ländercode");
  });

  it("sollte neue Institution mit Standardwerten erstellen", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("country_systems", [
      { country_code: "CH" },
    ]);

    const newInstitution = {
      id: "inst-1",
      name: "ETH Zürich",
      country_code: "CH",
      institution_type: "university",
      official_language: null,
    };

    mockSupabase._setTableData("institutions", [newInstitution]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "ETH Zürich",
          country_code: "CH",
        },
      }
    );

    const res = await POST_CREATE(req);
    const json = await expectSuccess(res, 201);

    expect(json.institution).toBeDefined();
    expect(json.institution.name).toBe("ETH Zürich");
    expect(json.institution.country_code).toBe("CH");
    expect(json.institution.institution_type).toBe("university");
  });

  it("sollte neue Institution mit allen Feldern erstellen", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("country_systems", [
      { country_code: "CH" },
    ]);

    const newInstitution = {
      id: "inst-2",
      name: "FH Zürich",
      country_code: "CH",
      institution_type: "university_of_applied_sciences",
      official_language: "de",
    };

    mockSupabase._setTableData("institutions", [newInstitution]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "FH Zürich",
          country_code: "CH",
          institution_type: "university_of_applied_sciences",
          official_language: "de",
        },
      }
    );

    const res = await POST_CREATE(req);
    const json = await expectSuccess(res, 201);

    expect(json.institution.name).toBe("FH Zürich");
    expect(json.institution.institution_type).toBe(
      "university_of_applied_sciences"
    );
    expect(json.institution.official_language).toBe("de");
  });

  it("sollte Audit-Log beim Erstellen schreiben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("country_systems", [
      { country_code: "CH" },
    ]);

    const newInstitution = {
      id: "inst-1",
      name: "ETH Zürich",
      country_code: "CH",
      institution_type: "university",
      official_language: null,
    };

    mockSupabase._setTableData("institutions", [newInstitution]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions",
      {
        method: "POST",
        body: {
          name: "ETH Zürich",
          country_code: "CH",
        },
      }
    );

    await POST_CREATE(req);

    expect(apiHelpers.logBuilderAction).toHaveBeenCalled();
    const callArgs = vi.mocked(apiHelpers.logBuilderAction).mock.calls[0];
    expect(callArgs[2]).toBe("create");
    expect(callArgs[3]).toBe("institution");
  });
});

describe("GET /api/academic/institutions/[id]", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockServiceClient.mockReturnValue(mockSupabase);
  });

  it("sollte 404 zurückgeben wenn Institution nicht existiert", async () => {
    mockSupabase._setTableData("institutions", [], {
      code: "PGRST116",
    });

    const res = await GET_BY_ID(
      createTestRequest("http://localhost:3000/api/academic/institutions/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    await expectError(res, 404, "nicht gefunden");
  });

  it("sollte einzelne Institution mit ID abrufen", async () => {
    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
      country_code: "CH",
      institution_type: "university",
      official_language: "de",
    };

    mockSupabase._setTableData("institutions", [institution]);

    const res = await GET_BY_ID(
      createTestRequest("http://localhost:3000/api/academic/institutions/inst-1"),
      { params: Promise.resolve({ id: "inst-1" }) }
    );

    const json = await expectSuccess(res);

    expect(json.institution).toBeDefined();
    expect(json.institution.id).toBe("inst-1");
    expect(json.institution.name).toBe("ETH Zürich");
  });

  it("sollte zugehörige Fakultäten abrufen", async () => {
    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    const faculties = [
      { id: "fac-1", name: "Engineering", institution_id: "inst-1" },
      { id: "fac-2", name: "Science", institution_id: "inst-1" },
    ];

    mockSupabase._setTableData("institutions", [institution]);
    mockSupabase._setTableData("faculties", faculties);

    const res = await GET_BY_ID(
      createTestRequest("http://localhost:3000/api/academic/institutions/inst-1"),
      { params: Promise.resolve({ id: "inst-1" }) }
    );

    const json = await expectSuccess(res);

    expect(json.faculties).toHaveLength(2);
    expect(json.faculties[0].name).toBe("Engineering");
    expect(json.faculties[1].name).toBe("Science");
  });

  it("sollte zugehörige Programme abrufen", async () => {
    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    const programs = [
      { id: "prog-1", name: "BSc Computer Science", institution_id: "inst-1" },
      { id: "prog-2", name: "MSc Physics", institution_id: "inst-1" },
    ];

    mockSupabase._setTableData("institutions", [institution]);
    mockSupabase._setTableData("programs", programs);

    const res = await GET_BY_ID(
      createTestRequest("http://localhost:3000/api/academic/institutions/inst-1"),
      { params: Promise.resolve({ id: "inst-1" }) }
    );

    const json = await expectSuccess(res);

    expect(json.programs).toHaveLength(2);
    expect(json.programs[0].name).toBe("BSc Computer Science");
  });

  it("sollte leere Fakultäts- und Programmenlisten zurückgeben wenn keine vorhanden", async () => {
    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    mockSupabase._setTableData("institutions", [institution]);
    mockSupabase._setTableData("faculties", []);
    mockSupabase._setTableData("programs", []);

    const res = await GET_BY_ID(
      createTestRequest("http://localhost:3000/api/academic/institutions/inst-1"),
      { params: Promise.resolve({ id: "inst-1" }) }
    );

    const json = await expectSuccess(res);

    expect(json.faculties).toEqual([]);
    expect(json.programs).toEqual([]);
  });
});

describe("PATCH /api/academic/institutions/[id]", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockServiceClient.mockReturnValue(mockSupabase);
  });

  it("sollte 403 zurückgeben wenn nicht berechtigt", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue(
      NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    );

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: { name: "Updated" },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    const result = await expectError(res, 403);
    expect(result).toHaveProperty("error");
  });

  it("sollte 403 zurückgeben wenn canManageInstitution false", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "user-1" },
      userRole: "institution",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(false);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: { name: "Updated" },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    await expectError(res, 403, "Berechtigung");
  });

  it("sollte 404 zurückgeben wenn Institution nicht existiert", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(true);

    mockSupabase._setTableData("institutions", [], {
      code: "PGRST116",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/nonexistent",
      {
        method: "PATCH",
        body: { name: "Updated" },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    await expectError(res, 404, "nicht gefunden");
  });

  it("sollte Institution-Name aktualisieren", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(true);

    const existing = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    const updated = {
      id: "inst-1",
      name: "ETH Zurich (Updated)",
    };

    mockSupabase._setTableData("institutions", [updated]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: { name: "ETH Zurich (Updated)" },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    const json = await expectSuccess(res);

    expect(json.institution.name).toBe("ETH Zurich (Updated)");
  });

  it("sollte 400 zurückgeben bei ungültigem Ländercode", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(true);

    const existing = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    mockSupabase._setTableData("institutions", [existing]);
    mockSupabase._setTableData("country_systems", [], {
      code: "PGRST116",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: { country_code: "XX" },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    await expectError(res, 400, "Ländercode");
  });

  it("sollte mehrere Felder gleichzeitig aktualisieren", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(true);

    const existing = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    const updated = {
      id: "inst-1",
      name: "ETH Zurich",
      institution_type: "research_institute",
      official_language: "en",
    };

    mockSupabase._setTableData("country_systems", [
      { country_code: "CH" },
    ]);
    mockSupabase._setTableData("institutions", [updated]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: {
          name: "ETH Zurich",
          institution_type: "research_institute",
          official_language: "en",
        },
      }
    );

    const res = await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    const json = await expectSuccess(res);

    expect(json.institution.name).toBe("ETH Zurich");
    expect(json.institution.institution_type).toBe("research_institute");
    expect(json.institution.official_language).toBe("en");
  });

  it("sollte Audit-Log beim Update schreiben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    vi.mocked(apiHelpers.canManageInstitution).mockResolvedValue(true);

    const existing = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    const updated = {
      id: "inst-1",
      name: "ETH Zurich",
    };

    mockSupabase._setTableData("institutions", [updated]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "PATCH",
        body: { name: "ETH Zurich" },
      }
    );

    await PATCH_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    expect(apiHelpers.logBuilderAction).toHaveBeenCalled();
    const callArgs = vi.mocked(apiHelpers.logBuilderAction).mock.calls[0];
    expect(callArgs[2]).toBe("update");
    expect(callArgs[3]).toBe("institution");
  });
});

describe("DELETE /api/academic/institutions/[id]", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockServiceClient.mockReturnValue(mockSupabase);
  });

  it("sollte 403 zurückgeben wenn nicht platform_admin", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue(
      NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })
    );

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    const result = await expectError(res, 403);
    expect(result).toHaveProperty("error");
  });

  it("sollte 404 zurückgeben wenn Institution nicht existiert", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    mockSupabase._setTableData("institutions", [], {
      code: "PGRST116",
    });

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/nonexistent",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE_BY_ID(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    await expectError(res, 404, "nicht gefunden");
  });

  it("sollte Institution erfolgreich löschen", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    mockSupabase._setTableData("institutions", [institution]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    const json = await expectSuccess(res);

    expect(json.success).toBe(true);
  });

  it("sollte Audit-Log beim Löschen schreiben", async () => {
    vi.mocked(apiHelpers.requireRole).mockResolvedValue({
      supabase: mockSupabase,
      user: { id: "admin-user" },
      userRole: "admin",
    });

    const institution = {
      id: "inst-1",
      name: "ETH Zürich",
    };

    mockSupabase._setTableData("institutions", [institution]);

    const req = createTestRequest(
      "http://localhost:3000/api/academic/institutions/inst-1",
      {
        method: "DELETE",
      }
    );

    await DELETE_BY_ID(req, {
      params: Promise.resolve({ id: "inst-1" }),
    });

    expect(apiHelpers.logBuilderAction).toHaveBeenCalled();
    const callArgs = vi.mocked(apiHelpers.logBuilderAction).mock.calls[0];
    expect(callArgs[2]).toBe("delete");
    expect(callArgs[3]).toBe("institution");
  });
});
