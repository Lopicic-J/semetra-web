/**
 * Tests for Stripe webhook plugin_purchase handling
 *
 * Tests the checkout.session.completed event when mode="payment" and metadata.type="plugin_purchase"
 * Ensures plugin purchases are recorded and auto-installed correctly
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Stripe from "stripe";

// Hoisted mocks — vi.hoisted ensures variables exist before vi.mock factories run
// supabaseAdmin is created at MODULE TOP LEVEL in route.ts via createClient(url, key).
// This runs at import time, BEFORE beforeEach. So mockCreateClient must return a
// valid shell object by default. We patch the shell's methods in beforeEach.
const {
  mockConstructEvent,
  mockListLineItems,
  mockRetrieveSubscription,
  mockCreateClient,
  supabaseShell,
} = vi.hoisted(() => {
  // Shell object that supabaseAdmin captures at import time.
  // Its methods get replaced in beforeEach with a fresh createMockSupabase().
  const shell: Record<string, any> = {
    from: vi.fn(() => shell),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    // chainable builder stubs so module-level code doesn't crash
    select: vi.fn(() => shell),
    eq: vi.fn(() => shell),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn(() => shell),
    insert: vi.fn(() => shell),
    delete: vi.fn(() => shell),
  };

  return {
    mockConstructEvent: vi.fn(),
    mockListLineItems: vi.fn(),
    mockRetrieveSubscription: vi.fn(),
    mockCreateClient: vi.fn().mockReturnValue(shell),
    supabaseShell: shell,
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    checkout: {
      sessions: {
        listLineItems: mockListLineItems,
      },
    },
    subscriptions: {
      retrieve: mockRetrieveSubscription,
    },
  },
  isAiAddonPrice: vi.fn(() => false),
  isLifetimeFullPrice: vi.fn(() => false),
  getTierFromPriceId: vi.fn(() => "basic"),
}));

vi.mock("@/lib/api-helpers", () => ({
  createServiceClient: mockCreateClient,
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "../route";
import { createMockSupabase } from "@/test/mocks/supabase";
import { createTestRequest, expectSuccess } from "@/test/helpers";

describe("Stripe Webhook - Plugin Purchase (plugin_purchase)", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();

    // Patch the shell (which IS supabaseAdmin from route.ts) to delegate to fresh mock.
    // supabaseAdmin was captured at module import time and can't be reassigned,
    // but we can replace its methods so it behaves like a fresh mock each test.
    supabaseShell.from = mockSupabase.from;
    supabaseShell.rpc = mockSupabase.rpc;
    supabaseShell._mocks = mockSupabase._mocks;
    supabaseShell._setTableData = mockSupabase._setTableData.bind(mockSupabase);

    // Re-set mockCreateClient since clearAllMocks cleared it
    mockCreateClient.mockReturnValue(supabaseShell);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("checkout.session.completed with plugin_purchase type", () => {
    it("should upsert plugin_purchases record with correct fields", async () => {
      const userId = "user-plugin-buyer-1";
      const pluginId = "plugin-pomodoro-plus";
      const sessionId = "cs_test_session_123";
      const paymentIntentId = "pi_test_payment_456";

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_123",
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
              supabase_user_id: userId,
            },
            payment_intent: paymentIntentId,
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Verify upsert was called with correct data
      expect(mockSupabase.from).toHaveBeenCalledWith("plugin_purchases");
      const pluginPurchasesBuilder = mockSupabase._mocks.plugin_purchases;
      expect(pluginPurchasesBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          plugin_id: pluginId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_checkout_session_id: sessionId,
          amount_chf: 1.9,
          status: "completed",
          granted_via: "purchase",
        }),
        { onConflict: "user_id,plugin_id" }
      );

      expect(json.received).toBe(true);
    });

    it("should auto-install plugin into user_plugins", async () => {
      const userId = "user-plugin-buyer-2";
      const pluginId = "plugin-grade-export";
      const sessionId = "cs_test_session_124";

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_124",
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
              supabase_user_id: userId,
            },
            payment_intent: "pi_test_payment_457",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Verify user_plugins was called
      expect(mockSupabase.from).toHaveBeenCalledWith("user_plugins");
      const userPluginsBuilder = mockSupabase._mocks.user_plugins;
      expect(userPluginsBuilder.upsert).toHaveBeenCalledWith(
        { user_id: userId, plugin_id: pluginId, enabled: true },
        { onConflict: "user_id,plugin_id" }
      );

      expect(json.received).toBe(true);
    });

    it("should handle plugin purchase when user found by stripe_customer_id", async () => {
      const userId = "user-plugin-buyer-3";
      const customerId = "cus_test_customer_789";
      const pluginId = "plugin-analytics";
      const sessionId = "cs_test_session_125";

      // Mock profile lookup by customer ID
      mockSupabase._setTableData("profiles", [
        { id: userId, stripe_customer_id: customerId },
      ]);

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: customerId,
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
            },
            payment_intent: "pi_test_payment_458",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      expect(mockSupabase.from).toHaveBeenCalledWith("plugin_purchases");
      const pluginPurchasesBuilder = mockSupabase._mocks.plugin_purchases;
      expect(pluginPurchasesBuilder.upsert).toHaveBeenCalled();

      expect(json.received).toBe(true);
    });

    it("should handle plugin purchase when user found by email", async () => {
      const userId = "user-plugin-buyer-4";
      const email = "buyer@example.com";
      const pluginId = "plugin-analytics";
      const sessionId = "cs_test_session_126";

      // Mock profile lookup by email
      mockSupabase._setTableData("profiles", [
        { id: userId, email },
      ]);

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer_details: { email },
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
            },
            payment_intent: "pi_test_payment_459",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      expect(mockSupabase.from).toHaveBeenCalledWith("plugin_purchases");
      const pluginPurchasesBuilder = mockSupabase._mocks.plugin_purchases;
      expect(pluginPurchasesBuilder.upsert).toHaveBeenCalled();

      expect(json.received).toBe(true);
    });

    it("should skip plugin purchase if no user found", async () => {
      const pluginId = "plugin-analytics";
      const sessionId = "cs_test_session_127";

      // Set empty profiles so no user is found
      mockSupabase._setTableData("profiles", []);

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
            },
            payment_intent: "pi_test_payment_460",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Should not call plugin_purchases.upsert
      expect(mockSupabase.from).not.toHaveBeenCalledWith("plugin_purchases");
      expect(json.received).toBe(true);
    });
  });

  describe("checkout.session.completed with regular subscription (no plugin metadata)", () => {
    it("should NOT create plugin_purchases when subscription mode with no plugin_id", async () => {
      const userId = "user-subscriber-1";
      const sessionId = "cs_test_session_subscription_1";
      const subscriptionId = "sub_test_123";
      const priceId = "price_pro_monthly";

      // Mock subscription retrieval
      mockRetrieveSubscription.mockResolvedValue({
        id: subscriptionId,
        status: "active",
        items: {
          data: [{ price: { id: priceId } }],
        },
      } as Stripe.Subscription);

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "subscription",
            customer: "cus_test_sub_1",
            subscription: subscriptionId,
            metadata: {
              supabase_user_id: userId,
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Should NOT call plugin_purchases.upsert
      expect(mockSupabase.from).not.toHaveBeenCalledWith("plugin_purchases");

      // Should call profiles.update for subscription
      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
      const profilesBuilder = mockSupabase._mocks.profiles;
      expect(profilesBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          plan_type: "subscription",
          stripe_subscription_id: subscriptionId,
        })
      );

      expect(json.received).toBe(true);
    });

    it("should follow normal subscription flow for payment.mode without metadata.type", async () => {
      const userId = "user-subscriber-2";
      const sessionId = "cs_test_session_payment_2";
      const lineItems: Stripe.LineItem[] = [
        {
          id: "item_1",
          object: "line_item",
          price: { id: "price_lifetime_full" },
        } as Stripe.LineItem,
      ];

      mockListLineItems.mockResolvedValue({ data: lineItems });

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_lifetime_1",
            metadata: {
              supabase_user_id: userId,
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Should NOT call plugin_purchases
      expect(mockSupabase.from).not.toHaveBeenCalledWith("plugin_purchases");

      // Should call profiles.update for lifetime purchase
      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");

      expect(json.received).toBe(true);
    });
  });

  describe("checkout.session.completed with plugin_id but wrong type", () => {
    it("should NOT treat as plugin purchase if metadata.type is missing", async () => {
      const userId = "user-wrong-type-1";
      const sessionId = "cs_test_session_128";
      const lineItems: Stripe.LineItem[] = [
        {
          id: "item_1",
          object: "line_item",
          price: { id: "price_addon_ai" },
        } as Stripe.LineItem,
      ];

      mockListLineItems.mockResolvedValue({ data: lineItems });

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_addon_1",
            metadata: {
              supabase_user_id: userId,
              plugin_id: "some-plugin", // Has plugin_id but no type
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Should NOT call plugin_purchases.upsert
      expect(mockSupabase.from).not.toHaveBeenCalledWith("plugin_purchases");

      expect(json.received).toBe(true);
    });

    it("should NOT treat as plugin purchase if type is different", async () => {
      const userId = "user-wrong-type-2";
      const sessionId = "cs_test_session_129";
      const lineItems: Stripe.LineItem[] = [
        {
          id: "item_1",
          object: "line_item",
          price: { id: "price_addon_ai" },
        } as Stripe.LineItem,
      ];

      mockListLineItems.mockResolvedValue({ data: lineItems });

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_addon_2",
            metadata: {
              supabase_user_id: userId,
              plugin_id: "plugin-id-123",
              type: "ai_addon", // Wrong type, not plugin_purchase
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Should NOT call plugin_purchases.upsert
      expect(mockSupabase.from).not.toHaveBeenCalledWith("plugin_purchases");

      expect(json.received).toBe(true);
    });
  });

  describe("Error handling for plugin purchase", () => {
    it("should return 400 on invalid signature", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_invalid" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid signature");
    });

    it("should return 500 on handler error during plugin purchase", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_error_1",
            mode: "payment",
            metadata: {
              type: "plugin_purchase",
              plugin_id: "plugin-fail",
              supabase_user_id: "user-fail",
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      // Mock upsert to throw error
      mockSupabase._mocks.plugin_purchases = {
        upsert: vi.fn().mockRejectedValue(new Error("DB error")),
      };
      mockSupabase.from = vi.fn((table: string) => {
        if (table === "plugin_purchases") {
          return mockSupabase._mocks.plugin_purchases;
        }
        return mockSupabase._mocks[table] || { upsert: vi.fn() };
      });

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Handler failed");
    });
  });

  describe("Plugin purchase idempotency", () => {
    it("should handle duplicate plugin purchase with same payment_intent", async () => {
      const userId = "user-idempotent-1";
      const pluginId = "plugin-duplicate";
      const sessionId = "cs_test_idempotent_1";
      const paymentIntentId = "pi_test_idempotent_1";

      // First upsert should succeed
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: sessionId,
            mode: "payment",
            customer: "cus_test_idempotent_1",
            metadata: {
              type: "plugin_purchase",
              plugin_id: pluginId,
              supabase_user_id: userId,
            },
            payment_intent: paymentIntentId,
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockConstructEvent.mockReturnValue(event);

      const req = createTestRequest(
        "http://localhost:3000/api/stripe/webhook",
        {
          method: "POST",
          body: "raw-body",
          headers: { "stripe-signature": "sig_test" },
        }
      );
      req.text = async () => "raw-body";

      const res = await POST(req);
      const json = await expectSuccess(res);

      // Verify upsert was called with onConflict clause for idempotency
      const pluginPurchasesBuilder = mockSupabase._mocks.plugin_purchases;
      expect(pluginPurchasesBuilder.upsert).toHaveBeenCalledWith(
        expect.any(Object),
        { onConflict: "user_id,plugin_id" }
      );

      expect(json.received).toBe(true);
    });
  });
});
