/**
 * Supabase Mock Factory
 *
 * Creates realistic mocks for Supabase client with chainable query builders.
 * Supports multiple table mocks and flexible data/error scenarios.
 */

import { vi } from "vitest";

/**
 * Create a chainable query builder mock matching Supabase API
 * Supports: select, insert, update, upsert, delete, filters, order, limit, etc.
 */
export function createMockQueryBuilder(data: any = [], error: any = null) {
  const builder: any = {
    _data: data,
    _error: error,
    _filters: [],

    // Query methods (return this for chaining)
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // Filter methods (return this for chaining)
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),

    // Ordering and limiting
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),

    // Terminal operations (return promises)
    single: vi
      .fn()
      .mockResolvedValue({
        data: Array.isArray(data) ? data[0] : data,
        error,
        count: null,
      }),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({
        data: Array.isArray(data) ? data[0] ?? null : data,
        error,
        count: null,
      }),

    // Count mode
    count: vi.fn().mockReturnThis(),

    // Make the builder awaitable via Symbol.toStringTag
    [Symbol.toStringTag]: "Promise",
  };

  // Override then/catch/finally to make it properly awaitable
  const promise = Promise.resolve({
    data,
    error,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    status: error ? 400 : 200,
  });

  builder.then = promise.then.bind(promise);
  builder.catch = promise.catch.bind(promise);
  builder.finally = promise.finally.bind(promise);

  return builder;
}

/**
 * Create a complete mock Supabase client
 * Supports auth operations, table queries, and RPC calls
 */
export function createMockSupabase(overrides: Record<string, any> = {}) {
  const mockUser = overrides.user ?? {
    id: "test-user-id-12345",
    email: "test@semetra.ch",
    user_metadata: {
      username: "testuser",
      full_name: "Test User",
    },
    created_at: "2024-01-01T00:00:00Z",
  };

  const fromMocks: Record<string, ReturnType<typeof createMockQueryBuilder>> = {};

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: "test-token-abc123",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },

    /**
     * from() - returns a query builder for the specified table
     * Maintains separate mocks per table for independent data
     */
    from: vi.fn((table: string) => {
      if (!fromMocks[table]) {
        fromMocks[table] = createMockQueryBuilder(overrides[table] ?? []);
      }
      return fromMocks[table];
    }),

    /**
     * rpc() - mock for RPC function calls
     */
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),

    // Utilities
    _mocks: fromMocks,
    _setTableData(table: string, data: any, error?: any) {
      fromMocks[table] = createMockQueryBuilder(data, error ?? null);
    },
    _setRpcResponse(data: any, error?: any) {
      supabase.rpc.mockResolvedValue({ data, error: error ?? null });
    },
    _setUser(user: any) {
      const updatedUser = { ...mockUser, ...user };
      supabase.auth.getUser.mockResolvedValue({
        data: { user: updatedUser },
        error: null,
      });
    },
    _setAuthError(error: string) {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: error },
      });
    },
  };

  return supabase;
}

/**
 * Mock the @/lib/supabase/server module
 * Use with vi.mock() before importing route handlers
 */
export function mockSupabaseServer(supabaseMock: ReturnType<typeof createMockSupabase>) {
  return {
    createClient: vi.fn(async () => supabaseMock),
  };
}
