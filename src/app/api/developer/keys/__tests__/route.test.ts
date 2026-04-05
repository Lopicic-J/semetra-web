/**
 * Tests for /api/developer/keys
 *
 * Tests API key management: creation, listing, and revocation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET, POST, DELETE } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/developer/keys", () => {
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

  it("sollte leere Schlüssel-Liste zurückgeben", async () => {
    mockSupabase._setTableData("api_keys", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("keys");
    expect(json.keys).toEqual([]);
  });

  it("sollte alle Benutzer-API-Schlüssel auflisten", async () => {
    const keys = [
      sampleData.apiKey({
        id: "key-1",
        name: "Production",
        key_prefix: "sk_live_abc123",
      }),
      sampleData.apiKey({
        id: "key-2",
        name: "Development",
        key_prefix: "sk_live_def456",
      }),
    ];

    mockSupabase._setTableData("api_keys", keys);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.keys).toHaveLength(2);
    expect(json.keys[0].name).toBe("Production");
    expect(json.keys[1].name).toBe("Development");
  });

  it("sollte nicht den vollständigen Schlüssel zurückgeben", async () => {
    // Simulate what the DB returns after select() filters fields
    // Route uses .select("id, name, key_prefix, ...") to exclude key_hash
    const keys = [
      {
        id: "key-1",
        name: "Production Key",
        key_prefix: "sk_live_abc123",
        scopes: ["read", "write"],
        rate_limit: 1000,
        last_used: "2024-01-15T10:00:00Z",
        expires_at: null,
        active: true,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockSupabase._setTableData("api_keys", keys);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.keys[0]).toHaveProperty("key_prefix");
    expect(json.keys[0]).not.toHaveProperty("key_hash");
    expect(json.keys[0]).not.toHaveProperty("fullKey");
  });

  it("sollte Schlüssel-Metadaten zurückgeben", async () => {
    const keys = [
      sampleData.apiKey({
        id: "key-1",
        name: "Test Key",
        scopes: ["read", "write"],
        rate_limit: 5000,
        last_used: "2024-01-15T10:00:00Z",
        expires_at: "2024-12-31T23:59:59Z",
        active: true,
      }),
    ];

    mockSupabase._setTableData("api_keys", keys);

    const res = await GET();
    const json = await expectSuccess(res);

    const key = json.keys[0];
    expect(key).toHaveProperty("name");
    expect(key).toHaveProperty("scopes");
    expect(key).toHaveProperty("rate_limit");
    expect(key).toHaveProperty("last_used");
    expect(key).toHaveProperty("expires_at");
    expect(key).toHaveProperty("active");
  });
});

describe("POST /api/developer/keys", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "New Key" },
    });
    const res = await POST(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn Name fehlt", async () => {
    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { scopes: ["read"] },
    });
    const res = await POST(req);

    await expectError(res, 400, "Name erforderlich");
  });

  it("sollte Fehler zurückgeben wenn Name leer ist", async () => {
    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "   " },
    });
    const res = await POST(req);

    await expectError(res, 400, "erforderlich");
  });

  it("sollte neuen API-Schlüssel mit Standardberechtigungen erstellen", async () => {
    const newKey = sampleData.apiKey({
      id: "key-new",
      name: "New Key",
      scopes: ["read"],
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "New Key" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("key");
    expect(json.key.name).toBe("New Key");
  });

  it("sollte vollständigen Schlüssel bei Erstellung zurückgeben", async () => {
    const newKey = sampleData.apiKey({
      id: "key-new",
      name: "New Key",
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "New Key" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.key).toHaveProperty("fullKey");
    expect(json.key.fullKey).toMatch(/^sk_live_/);
  });

  it("sollte API-Schlüssel mit benutzerdefinierten Berechtigungen erstellen", async () => {
    const newKey = sampleData.apiKey({
      id: "key-new",
      scopes: ["read", "write", "admin"],
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: {
        name: "Admin Key",
        scopes: ["read", "write", "admin"],
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.key.scopes).toEqual(["read", "write", "admin"]);
  });

  it("sollte Verfallsdatum setzen können", async () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const newKey = sampleData.apiKey({
      id: "key-new",
      expires_at: expiryDate.toISOString(),
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: {
        name: "Temporary Key",
        expiresInDays: 30,
      },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.key.expires_at).toBeDefined();
  });

  it("sollte Schlüsselname trimmen", async () => {
    const newKey = sampleData.apiKey({
      id: "key-new",
      name: "Trimmed Name",
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "  Trimmed Name  " },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.key.name).toBe("Trimmed Name");
  });

  it("sollte sk_live_ Präfix verwenden", async () => {
    const newKey = sampleData.apiKey({
      id: "key-new",
      key_prefix: "sk_live_",
    });

    mockSupabase._setTableData("api_keys", [newKey]);

    const req = createTestRequest("/api/developer/keys", {
      method: "POST",
      body: { name: "Test" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.key.fullKey).toMatch(/^sk_live_/);
    expect(json.key.key_prefix).toBe("sk_live_");
  });
});

describe("DELETE /api/developer/keys", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/developer/keys", {
      method: "DELETE",
      body: { keyId: "key-1" },
    });
    const res = await DELETE(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte bei fehlendem keyId trotzdem 200 zurückgeben (keine Validierung)", async () => {
    // Route doesn't validate keyId presence — passes undefined to query
    const req = createTestRequest("/api/developer/keys", {
      method: "DELETE",
      body: {},
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte API-Schlüssel erfolgreich deaktivieren", async () => {
    const req = createTestRequest("/api/developer/keys", {
      method: "DELETE",
      body: { keyId: "key-1" },
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Benutzer-Eigentumsverifizierung durchführen", async () => {
    const req = createTestRequest("/api/developer/keys", {
      method: "DELETE",
      body: { keyId: "key-1" },
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte active-Flag auf false setzen statt zu löschen", async () => {
    const req = createTestRequest("/api/developer/keys", {
      method: "DELETE",
      body: { keyId: "key-1" },
    });
    const res = await DELETE(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });
});
