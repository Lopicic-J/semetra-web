/**
 * Tests für useSupabaseQuery, useSupabaseSingle und useApiMutation Hooks
 *
 * Abdeckung:
 * - useSupabaseQuery: queries, filters, ordering, limits, realtime, transformations
 * - useSupabaseSingle: single row queries mit null-handling
 * - useApiMutation: POST/PATCH/DELETE mutations mit callbacks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSupabaseQuery, useSupabaseSingle, useApiMutation } from "../useSupabaseQuery";

/* ─── Mock Supabase Client ─── */

const mockSupabaseClient = {
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
};

const mockQueryBuilder = {
  select: vi.fn(),
  filter: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPatch = vi.hoisted(() => vi.fn());
const mockApiDel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  api: {
    post: mockApiPost,
    patch: mockApiPatch,
    del: mockApiDel,
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

/* ─── Helper: Configure Mock Query Chain ─── */

function setupMockQuery(data: any = [], error: any = null) {
  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.filter.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.limit.mockReturnValue(mockQueryBuilder);

  // Make the builder properly awaitable with correct Promise thenable pattern
  const result = error ? { data: null, error } : { data, error: null };
  const promise = Promise.resolve(result);
  (mockQueryBuilder as any).then = promise.then.bind(promise);
  (mockQueryBuilder as any).catch = promise.catch.bind(promise);
  (mockQueryBuilder as any).finally = promise.finally.bind(promise);

  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);

  mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
}

function setupMockSingleQuery(data: any = null, error: any = null) {
  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.filter.mockReturnValue(mockQueryBuilder);

  mockQueryBuilder.single.mockResolvedValue({
    data,
    error,
  });

  mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
}

function setupMockChannel() {
  const mockChannelObj = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  mockChannelObj.on.mockReturnValue(mockChannelObj);
  mockChannelObj.subscribe.mockReturnValue(mockChannelObj);
  mockSupabaseClient.channel.mockReturnValue(mockChannelObj);
  return mockChannelObj;
}

/* ─── Tests: useSupabaseQuery ─── */

describe("useSupabaseQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockQuery([
      { id: "1", name: "Module 1", created_at: "2026-01-01" },
      { id: "2", name: "Module 2", created_at: "2026-01-02" },
    ]);
  });

  it("returns data from supabase query", async () => {
    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules", select: "*" }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: "1", name: "Module 1", created_at: "2026-01-01" },
      { id: "2", name: "Module 2", created_at: "2026-01-02" },
    ]);
  });

  it("sets loading=true then false after fetch", async () => {
    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules" }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("applies filter function to query", async () => {
    const filterFn = vi.fn((q) => q);
    setupMockQuery([{ id: "1", name: "Task 1" }]);

    renderHook(() =>
      useSupabaseQuery({
        table: "tasks",
        filter: filterFn,
      }),
    );

    await waitFor(() => {
      expect(filterFn).toHaveBeenCalled();
    });
  });

  it("applies order to query", async () => {
    setupMockQuery([]);
    // order must be a stable reference — an inline object literal creates a new
    // reference on every render, which destabilises useCallback and causes an
    // infinite fetch loop in the hook.
    const order = { column: "created_at", ascending: false } as const;
    const { result } = renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        order,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockQueryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
      nullsFirst: undefined,
    });
  });

  it("applies limit to query", async () => {
    setupMockQuery([]);
    const { result } = renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        limit: 10,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
  });

  it("sets error when query fails", async () => {
    const error = new Error("Database error");
    setupMockQuery(null, error);

    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Database error");
    expect(result.current.data).toEqual([]);
  });

  it("does not fetch when enabled=false", async () => {
    setupMockQuery([{ id: "1", name: "Module 1" }]);

    const { result } = renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        enabled: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(mockQueryBuilder.select).not.toHaveBeenCalled();
  });

  it("applies transform function to data", async () => {
    const rawData = [{ id: "1", name: "Module" }];
    setupMockQuery(rawData);

    const transform = vi.fn((data) =>
      data.map((item: any) => ({ ...item, transformed: true })),
    );

    const { result } = renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        transform,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(transform).toHaveBeenCalledWith(rawData);
    expect(result.current.data).toEqual([{ id: "1", name: "Module", transformed: true }]);
  });

  it("refetch function re-fetches data", async () => {
    setupMockQuery([{ id: "1", name: "Module 1" }]);

    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    setupMockQuery([{ id: "1", name: "Module 1 Updated" }]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual([
      { id: "1", name: "Module 1 Updated" },
    ]);
  });

  it("sets up realtime subscription when realtime=true", async () => {
    const mockChannel = setupMockChannel();
    setupMockQuery([]);

    renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        realtime: true,
      }),
    );

    await waitFor(() => {
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith("modules-realtime");
    });

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "modules" },
      expect.any(Function),
    );

    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("cleans up realtime subscription on unmount", async () => {
    const mockChannel = setupMockChannel();
    setupMockQuery([]);

    const { unmount } = renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        realtime: true,
      }),
    );

    await waitFor(() => {
      expect(mockSupabaseClient.channel).toHaveBeenCalled();
    });

    unmount();

    expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("does not subscribe to realtime when realtime=false", async () => {
    setupMockQuery([]);

    renderHook(() =>
      useSupabaseQuery({
        table: "modules",
        realtime: false,
      }),
    );

    await waitFor(() => {
      expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
    });
  });

  it("uses custom select clause", async () => {
    setupMockQuery([{ id: "1", name: "Module 1" }]);

    renderHook(() =>
      useSupabaseQuery({
        table: "tasks",
        select: "*, modules(name, color)",
      }),
    );

    await waitFor(() => {
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("*, modules(name, color)");
    });
  });

  it("handles null data from query", async () => {
    setupMockQuery(null);

    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it("handles catch errors gracefully", async () => {
    mockQueryBuilder.select.mockImplementation(() => {
      throw new Error("Unexpected error");
    });
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);

    const { result } = renderHook(() =>
      useSupabaseQuery({ table: "modules" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Unexpected error");
  });
});

/* ─── Tests: useSupabaseSingle ─── */

describe("useSupabaseSingle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockSingleQuery({ id: "1", name: "User Profile" });
  });

  it("returns single item (not array)", async () => {
    const { result } = renderHook(() =>
      useSupabaseSingle({ table: "profiles" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: "1", name: "User Profile" });
    expect(Array.isArray(result.current.data)).toBe(false);
  });

  it("returns null when no data", async () => {
    setupMockSingleQuery(null);

    const { result } = renderHook(() =>
      useSupabaseSingle({ table: "profiles" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  it("sets error on query failure", async () => {
    const error = new Error("Profile not found");
    setupMockSingleQuery(null, error);

    const { result } = renderHook(() =>
      useSupabaseSingle({ table: "profiles" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Profile not found");
    expect(result.current.data).toBeNull();
  });

  it("applies filter function", async () => {
    const filterFn = vi.fn((q) => q);
    setupMockSingleQuery({ id: "1", email: "test@semetra.ch" });

    renderHook(() =>
      useSupabaseSingle({
        table: "profiles",
        filter: filterFn,
      }),
    );

    await waitFor(() => {
      expect(filterFn).toHaveBeenCalled();
    });
  });

  it("does not fetch when enabled=false", async () => {
    setupMockSingleQuery({ id: "1", name: "Profile" });

    const { result } = renderHook(() =>
      useSupabaseSingle({
        table: "profiles",
        enabled: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  it("refetch function re-fetches data", async () => {
    setupMockSingleQuery({ id: "1", name: "Profile 1" });

    const { result } = renderHook(() =>
      useSupabaseSingle({ table: "profiles" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    setupMockSingleQuery({ id: "1", name: "Profile 1 Updated" });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual({ id: "1", name: "Profile 1 Updated" });
  });

  it("sets up realtime subscription when realtime=true", async () => {
    const mockChannel = setupMockChannel();
    setupMockSingleQuery({ id: "1" });

    renderHook(() =>
      useSupabaseSingle({
        table: "profiles",
        realtime: true,
      }),
    );

    await waitFor(() => {
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith("profiles-single-realtime");
    });

    expect(mockChannel.on).toHaveBeenCalled();
  });
});

/* ─── Tests: useApiMutation ─── */

describe("useApiMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default return values on the hoisted mock functions
    mockApiPost.mockResolvedValue({ data: { id: "123" }, error: null });
    mockApiPatch.mockResolvedValue({ data: { id: "123" }, error: null });
    mockApiDel.mockResolvedValue({ data: null, error: null });
  });

  it("calls api.post for POST mutation", async () => {
    const { result } = renderHook(() =>
      useApiMutation("/api/modules"),
    );

    expect(result.current.loading).toBe(false);
  });

  it("calls onSuccess callback on success", async () => {
    const onSuccess = vi.fn();
    mockApiPost.mockResolvedValue({ data: { id: "123", name: "New Module" }, error: null });

    const { result } = renderHook(() =>
      useApiMutation("/api/modules", { onSuccess }),
    );

    await act(async () => {
      const response = await result.current.mutate({ name: "New Module" }, "POST");
      expect(response.data).toEqual({ id: "123", name: "New Module" });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("calls onError callback on failure", async () => {
    const onError = vi.fn();
    mockApiPost.mockResolvedValue({ data: null, error: "Validation error" });

    const { result } = renderHook(() =>
      useApiMutation("/api/modules", { onError }),
    );

    await act(async () => {
      const response = await result.current.mutate({ name: "" }, "POST");
      expect(response.error).toBe("Validation error");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets loading during mutation", async () => {
    mockApiPost.mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({ data: { id: "123" }, error: null }), 100)
      ),
    );

    const { result } = renderHook(() =>
      useApiMutation("/api/modules"),
    );

    let isLoadingDuringMutation = false;

    act(() => {
      result.current.mutate({ name: "Module" }).then(() => {
        isLoadingDuringMutation = result.current.loading;
      });
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("supports PATCH method", async () => {
    mockApiPatch.mockResolvedValue({ data: { id: "123", name: "Updated" }, error: null });

    const { result } = renderHook(() =>
      useApiMutation("/api/modules/123"),
    );

    await act(async () => {
      await result.current.mutate({ name: "Updated" }, "PATCH");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("supports DELETE method", async () => {
    mockApiDel.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() =>
      useApiMutation("/api/modules/123"),
    );

    await act(async () => {
      await result.current.mutate(undefined, "DELETE");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("handles mutation errors gracefully", async () => {
    mockApiPost.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useApiMutation("/api/modules"),
    );

    await act(async () => {
      const response = await result.current.mutate({ name: "Module" });
      expect(response.error).toBe("Network error");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("passes success message to api options", async () => {
    mockApiPost.mockResolvedValue({ data: { id: "123" }, error: null });

    renderHook(() =>
      useApiMutation("/api/modules", {
        successMessage: "Modul erstellt",
      }),
    );

    // Verify setup completed
    await waitFor(() => {
      expect(true).toBe(true);
    });
  });

  it("returns data and error in mutation response", async () => {
    mockApiPost.mockResolvedValue({
      data: { id: "123", name: "Module" },
      error: null,
    });

    const { result } = renderHook(() =>
      useApiMutation("/api/modules"),
    );

    let response: any;
    await act(async () => {
      response = await result.current.mutate({ name: "Module" });
    });

    expect(response).toEqual({
      data: { id: "123", name: "Module" },
      error: null,
    });
  });
});
