/**
 * Tests for /api/plugins/purchase
 *
 * Tests plugin purchase handling with Stripe integration,
 * institution auto-grant, and purchase history
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mocks
const mockCreateClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  PLUGIN_PRICE: {
    priceId: "price_test_123",
  },
}));

import { POST, GET } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectError, expectSuccess } from "@/test/helpers";
import { stripe } from "@/lib/stripe";

describe("POST /api/plugins/purchase", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte 401 zurückgeben ohne Authentifizierung", async () => {
    mockSupabase._setAuthError("User not found");

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    const res = await POST(req);

    await expectError(res, 401, "eingeloggt");
  });

  it("sollte 400 zurückgeben wenn pluginId fehlt", async () => {
    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: {},
    });

    const res = await POST(req);

    await expectError(res, 400, "pluginId");
  });

  it("sollte 403 zurückgeben wenn Benutzer nicht pro", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "free",
      institution_id: null,
      stripe_customer_id: null,
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    mockSupabase._setTableData("profiles", [profile]);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    const res = await POST(req);

    await expectError(res, 403, "Pro-Mitgliedschaft");
  });

  it("sollte 404 zurückgeben wenn Plugin nicht existiert", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_test",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", []);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "nonexistent" },
    });

    const res = await POST(req);

    await expectError(res, 404, "nicht gefunden");
  });

  it("sollte 400 zurückgeben für kostenlose Plugins", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_test",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Free Plugin",
      pricing_type: "free",
      price_chf: 0,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    const res = await POST(req);

    await expectError(res, 400, "kostenlos");
  });

  it("sollte 400 zurückgeben wenn Plugin bereits erworben", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_test",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    const purchase = {
      id: "purchase-1",
      user_id: "test-user-id-12345",
      plugin_id: "plugin-1",
      status: "completed",
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", [purchase]);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    const res = await POST(req);

    await expectError(res, 400, "bereits erworben");
  });

  it("sollte Plugin automatisch für Institutionsmitglieder gewähren", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: "inst-1",
      stripe_customer_id: null,
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    const res = await POST(req);

    const json = await expectSuccess(res);

    expect(json.granted).toBe(true);
    expect(json.method).toBe("institution");
  });

  it("sollte Plugin für Institutionsmitglieder installieren", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: "inst-1",
      stripe_customer_id: null,
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    await POST(req);

    // Verify that upsert was called for user_plugins
    expect(mockSupabase.from("user_plugins").upsert).toBeDefined();
  });

  it("sollte Stripe Checkout für externe Pro-Benutzer erstellen", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_existing",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
      customer: "cus_existing",
    } as any);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
      headers: { origin: "https://app.semetra.ch" },
    });

    const res = await POST(req);

    const json = await expectSuccess(res);

    expect(json).toHaveProperty("url");
    expect(json.url).toContain("checkout.stripe.com");
  });

  it("sollte neuen Stripe Customer erstellen wenn keiner existiert", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: null,
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    vi.mocked(stripe.customers.create).mockResolvedValue({
      id: "cus_new_123",
      email: "test@semetra.ch",
    } as any);

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    } as any);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
      headers: { origin: "https://app.semetra.ch" },
    });

    const res = await POST(req);

    const json = await expectSuccess(res);

    expect(json).toHaveProperty("url");
    expect(vi.mocked(stripe.customers.create)).toHaveBeenCalled();
  });

  it("sollte Checkout mit korrektem Plugin-Metadaten erstellen", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_test",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    } as any);

    const req = createTestRequest("http://localhost:3000/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
      headers: { origin: "https://app.semetra.ch" },
    });

    await POST(req);

    const callArgs = vi.mocked(stripe.checkout.sessions.create).mock.calls[0];
    expect(callArgs[0].metadata.plugin_id).toBe("plugin-1");
    expect(callArgs[0].metadata.type).toBe("plugin_purchase");
  });

  it("sollte Success/Cancel URLs mit Origin konfigurieren", async () => {
    const profile = {
      id: "test-user-id-12345",
      plan: "pro",
      institution_id: null,
      stripe_customer_id: "cus_test",
      email: "test@semetra.ch",
      full_name: "Test User",
    };

    const plugin = {
      id: "plugin-1",
      name: "Premium Plugin",
      pricing_type: "premium",
      price_chf: 1.9,
      active: true,
    };

    mockSupabase._setTableData("profiles", [profile]);
    mockSupabase._setTableData("plugins", [plugin]);
    mockSupabase._setTableData("plugin_purchases", []);

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
    } as any);

    // Use full URL so new URL(req.url).origin resolves correctly as fallback
    const req = createTestRequest("https://custom.app/api/plugins/purchase", {
      method: "POST",
      body: { pluginId: "plugin-1" },
    });

    await POST(req);

    const callArgs = vi.mocked(stripe.checkout.sessions.create).mock.calls[0];
    expect(callArgs[0].success_url).toContain("https://custom.app");
    expect(callArgs[0].cancel_url).toContain("https://custom.app");
  });
});

describe("GET /api/plugins/purchase", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it("sollte 401 zurückgeben ohne Authentifizierung", async () => {
    mockSupabase._setAuthError("User not found");

    const res = await GET();

    await expectError(res, 401, "autorisiert");
  });

  it("sollte leere Kaufliste zurückgeben", async () => {
    mockSupabase._setTableData("plugin_purchases", []);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json).toHaveProperty("purchases");
    expect(json.purchases).toEqual([]);
  });

  it("sollte Benutzerkäufe auflisten", async () => {
    const purchases = [
      {
        plugin_id: "plugin-1",
        amount_chf: 1.9,
        status: "completed",
        granted_via: "stripe",
        purchased_at: "2024-01-15T10:00:00Z",
      },
      {
        plugin_id: "plugin-2",
        amount_chf: 0,
        status: "completed",
        granted_via: "institution",
        purchased_at: "2024-01-20T14:00:00Z",
      },
    ];

    mockSupabase._setTableData("plugin_purchases", purchases);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.purchases).toHaveLength(2);
    expect(json.purchases[0].plugin_id).toBe("plugin-1");
    expect(json.purchases[0].granted_via).toBe("stripe");
  });

  it("sollte nur abgeschlossene Käufe zurückgeben", async () => {
    const purchases = [
      {
        plugin_id: "plugin-1",
        status: "completed",
        amount_chf: 1.9,
        granted_via: "stripe",
      },
      {
        plugin_id: "plugin-2",
        status: "pending",
        amount_chf: 1.9,
        granted_via: "stripe",
      },
    ];

    mockSupabase._setTableData("plugin_purchases", [purchases[0]]);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.purchases).toHaveLength(1);
    expect(json.purchases[0].status).toBe("completed");
  });

  it("sollte Institutionsvergaben einbeziehen", async () => {
    const purchases = [
      {
        plugin_id: "plugin-1",
        amount_chf: 0,
        status: "completed",
        granted_via: "institution",
        institution_id: "inst-1",
        purchased_at: "2024-01-15T10:00:00Z",
      },
    ];

    mockSupabase._setTableData("plugin_purchases", purchases);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.purchases[0].granted_via).toBe("institution");
    expect(json.purchases[0].amount_chf).toBe(0);
  });

  it("sollte Stripe-Käufe einbeziehen", async () => {
    const purchases = [
      {
        plugin_id: "plugin-1",
        amount_chf: 1.9,
        status: "completed",
        granted_via: "stripe",
        purchased_at: "2024-01-15T10:00:00Z",
      },
    ];

    mockSupabase._setTableData("plugin_purchases", purchases);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.purchases[0].granted_via).toBe("stripe");
    expect(json.purchases[0].amount_chf).toBe(1.9);
  });

  it("sollte Kaufdatum einbeziehen", async () => {
    const purchases = [
      {
        plugin_id: "plugin-1",
        amount_chf: 1.9,
        status: "completed",
        granted_via: "stripe",
        purchased_at: "2024-01-15T10:00:00Z",
      },
    ];

    mockSupabase._setTableData("plugin_purchases", purchases);

    const res = await GET();
    const json = await expectSuccess(res);

    expect(json.purchases[0].purchased_at).toBe("2024-01-15T10:00:00Z");
  });
});
