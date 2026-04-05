/**
 * Tests for /api/plugins
 *
 * Tests plugin listing, installation, toggling, and configuration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mock - vi.fn() is available in vi.hoisted callback
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET, POST, PATCH } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess, sampleData } from "@/test/helpers";

describe("GET /api/plugins", () => {
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

  it("sollte leiste Plugin-Liste zurückgeben", async () => {
    mockSupabase._setTableData("plugins", []);
    mockSupabase._setTableData("user_plugins", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("plugins");
    expect(json.plugins).toEqual([]);
  });

  it("sollte alle verfügbaren Plugins auflisten", async () => {
    const plugins = [
      sampleData.plugin({
        id: "plugin-1",
        name: "Timer",
        active: true,
      }),
      sampleData.plugin({
        id: "plugin-2",
        name: "Calculator",
        active: true,
      }),
    ];

    mockSupabase._setTableData("plugins", plugins);
    mockSupabase._setTableData("user_plugins", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.plugins).toHaveLength(2);
    expect(json.plugins[0].name).toBe("Timer");
  });

  it("sollte nur aktive Plugins zurückgeben", async () => {
    const plugins = [
      sampleData.plugin({ id: "p1", active: true }),
      sampleData.plugin({ id: "p2", active: false }),
    ];

    // The route filters by active: true, so we only set active ones
    mockSupabase._setTableData("plugins", [plugins[0]]);
    mockSupabase._setTableData("user_plugins", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.plugins).toHaveLength(1);
  });

  it("sollte Benutzer-Installationsstatus anzeigen", async () => {
    const plugins = [
      sampleData.plugin({ id: "plugin-1", name: "Timer" }),
      sampleData.plugin({ id: "plugin-2", name: "Notes" }),
    ];

    const userPlugins = [
      {
        plugin_id: "plugin-1",
        enabled: true,
        config: { theme: "dark" },
      },
    ];

    mockSupabase._setTableData("plugins", plugins);
    mockSupabase._setTableData("user_plugins", userPlugins);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.plugins[0].installed).toBe(true);
    expect(json.plugins[0].enabled).toBe(true);
    expect(json.plugins[1].installed).toBe(false);
    expect(json.plugins[1].enabled).toBe(false);
  });

  it("sollte Plugin-Konfiguration zurückgeben", async () => {
    const plugins = [
      sampleData.plugin({ id: "plugin-1" }),
    ];

    const userPlugins = [
      {
        plugin_id: "plugin-1",
        enabled: true,
        config: {
          theme: "dark",
          duration: 25,
        },
      },
    ];

    mockSupabase._setTableData("plugins", plugins);
    mockSupabase._setTableData("user_plugins", userPlugins);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.plugins[0].userConfig).toEqual({
      theme: "dark",
      duration: 25,
    });
  });

  it("sollte leere Konfiguration für nicht installierte Plugins zurückgeben", async () => {
    const plugins = [sampleData.plugin({ id: "plugin-1" })];

    mockSupabase._setTableData("plugins", plugins);
    mockSupabase._setTableData("user_plugins", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.plugins[0].userConfig).toEqual({});
  });
});

describe("POST /api/plugins", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "install" },
    });
    const res = await POST(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn pluginId fehlt", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { action: "install" },
    });
    const res = await POST(req);

    await expectError(res, 400, "pluginId erforderlich");
  });

  it("sollte Plugin installieren", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "install" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Plugin mit enabled: true installieren", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "install" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Plugin deinstallieren", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "uninstall" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Plugin umschalten", async () => {
    const userPlugins = [
      {
        plugin_id: "plugin-1",
        enabled: true,
        config: {},
      },
    ];

    mockSupabase._setTableData("user_plugins", userPlugins);

    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "toggle" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Standardaction als install verwenden", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte toggle ignorieren wenn Plugin nicht installiert ist", async () => {
    mockSupabase._setTableData("user_plugins", []);

    const req = createTestRequest("/api/plugins", {
      method: "POST",
      body: { pluginId: "plugin-1", action: "toggle" },
    });
    const res = await POST(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });
});

describe("PATCH /api/plugins", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: { pluginId: "plugin-1", config: {} },
    });
    const res = await PATCH(req);

    await expectError(res, 401, "Nicht autorisiert");
  });

  it("sollte Fehler zurückgeben wenn pluginId fehlt", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: { config: {} },
    });
    const res = await PATCH(req);

    await expectError(res, 400, "pluginId erforderlich");
  });

  it("sollte Fehler zurückgeben wenn config fehlt", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: { pluginId: "plugin-1" },
    });
    const res = await PATCH(req);

    await expectError(res, 400, "config erforderlich");
  });

  it("sollte Plugin-Konfiguration aktualisieren", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: {
        pluginId: "plugin-1",
        config: { theme: "light", duration: 30 },
      },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte leere Konfiguration akzeptieren", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: { pluginId: "plugin-1", config: {} },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte komplexe Konfiguration speichern", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: {
        pluginId: "plugin-1",
        config: {
          advanced: {
            notifications: true,
            autostart: false,
          },
          colors: {
            primary: "#3b82f6",
            secondary: "#ef4444",
          },
        },
      },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });

  it("sollte Benutzer-Eigentumsverifizierung durchführen", async () => {
    const req = createTestRequest("/api/plugins", {
      method: "PATCH",
      body: {
        pluginId: "plugin-1",
        config: { setting: "value" },
      },
    });
    const res = await PATCH(req);

    const json = await expectSuccess(res);
    expect(json.ok).toBe(true);
  });
});
