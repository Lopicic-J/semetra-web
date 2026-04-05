/**
 * API Client Tests
 *
 * Tests für den zentralen API-Client mit Retry, Timeout und Error-Handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock react-hot-toast before importing api-client
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { api, ApiError, NetworkError, TimeoutError, optimistic } from "../api-client";
import toast from "react-hot-toast";

/* ─── Helpers ─── */

function mockFetchSuccess(data: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(errorBody: any, status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(errorBody),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
}

/* ─── Setup ─── */

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

/* ─── Tests ─── */

describe("api-client", () => {
  describe("GET Anfragen", () => {
    it("gibt Daten bei erfolgreichem GET zurück", async () => {
      const mockData = { modules: [{ id: "1", name: "Mathematik" }] };
      globalThis.fetch = mockFetchSuccess(mockData);

      const result = await api.get("/api/modules");

      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/modules",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("sendet keine Body bei GET", async () => {
      globalThis.fetch = mockFetchSuccess({});
      await api.get("/api/test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({ body: undefined }),
      );
    });
  });

  describe("POST / PATCH / DELETE Anfragen", () => {
    it("sendet JSON-Body bei POST", async () => {
      const body = { name: "Physik", credits: 6 };
      globalThis.fetch = mockFetchSuccess({ id: "new-id" }, 201);

      const result = await api.post("/api/modules", body);

      expect(result.status).toBe(201);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/modules",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    });

    it("sendet PATCH korrekt", async () => {
      globalThis.fetch = mockFetchSuccess({ updated: true });
      await api.patch("/api/modules/123", { name: "Neu" });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/modules/123",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("sendet DELETE korrekt", async () => {
      globalThis.fetch = mockFetchSuccess(null);
      await api.del("/api/modules/123");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/modules/123",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("sendet PUT korrekt", async () => {
      globalThis.fetch = mockFetchSuccess({ ok: true });
      await api.put("/api/items/1", { done: true });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/items/1",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  describe("Fehlerbehandlung", () => {
    it("zeigt Toast bei HTTP-Fehler (400)", async () => {
      globalThis.fetch = mockFetchError({ error: "Ungültige Daten" }, 400);

      const result = await api.get("/api/test", { retries: 0 });

      expect(result.error).toBe("Ungültige Daten");
      expect(result.data).toBeNull();
      expect(result.status).toBe(400);
      expect(toast.error).toHaveBeenCalledWith("Ungültige Daten");
    });

    it("verwendet statusMessage wenn kein Server-Error", async () => {
      globalThis.fetch = mockFetchError({}, 403);

      const result = await api.get("/api/test", { retries: 0 });

      expect(result.error).toBe("Zugriff verweigert");
    });

    it("unterdrückt Toast wenn showErrorToast=false", async () => {
      globalThis.fetch = mockFetchError({ error: "Nope" }, 400);

      await api.get("/api/test", { retries: 0, showErrorToast: false });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("verwendet custom errorMessage", async () => {
      globalThis.fetch = mockFetchError({ error: "Server sagt nein" }, 400);

      const result = await api.get("/api/test", {
        retries: 0,
        errorMessage: "Benutzerdefinierter Fehler",
      });

      expect(result.error).toBe("Benutzerdefinierter Fehler");
      expect(toast.error).toHaveBeenCalledWith("Benutzerdefinierter Fehler");
    });
  });

  describe("Retry-Logik", () => {
    it("wiederholt bei 500er-Fehlern", async () => {
      const fetch500 = mockFetchError({ error: "Internal" }, 500);
      // After 2 retries (3 total calls), eventually return error
      globalThis.fetch = fetch500;

      const resultPromise = api.get("/api/test", { retries: 2 });

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1500);
      await vi.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      expect(result.error).toBeTruthy();
      expect(fetch500).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("wiederholt bei 429 (Rate-Limit)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false, status: 429,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ error: "Rate limit" }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ data: "ok" }),
        });
      globalThis.fetch = fetchMock;

      const resultPromise = api.get("/api/test", { retries: 1 });
      await vi.advanceTimersByTimeAsync(600);

      const result = await resultPromise;
      expect(result.data).toEqual({ data: "ok" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("wiederholt NICHT bei 400er-Fehlern", async () => {
      globalThis.fetch = mockFetchError({ error: "Bad" }, 400);

      const result = await api.get("/api/test", { retries: 2 });

      expect(result.error).toBe("Bad");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Erfolgs-Toasts", () => {
    it("zeigt Success-Toast wenn showSuccessToast=true", async () => {
      globalThis.fetch = mockFetchSuccess({ ok: true });

      await api.post("/api/test", {}, {
        showSuccessToast: true,
        successMessage: "Gespeichert!",
      });

      expect(toast.success).toHaveBeenCalledWith("Gespeichert!");
    });

    it("zeigt KEINEN Success-Toast standardmässig", async () => {
      globalThis.fetch = mockFetchSuccess({ ok: true });

      await api.post("/api/test", {});

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("Extra-Headers", () => {
    it("übergibt zusätzliche Headers", async () => {
      globalThis.fetch = mockFetchSuccess({});

      await api.get("/api/test", {
        headers: { "X-Custom": "value" },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Custom": "value",
          }),
        }),
      );
    });
  });
});

describe("Error-Klassen", () => {
  it("ApiError hat status und serverMessage", () => {
    const err = new ApiError("Not found", 404, "Resource missing");
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.serverMessage).toBe("Resource missing");
    expect(err.message).toBe("Not found");
  });

  it("NetworkError hat Default-Message", () => {
    const err = new NetworkError();
    expect(err.name).toBe("NetworkError");
    expect(err.message).toContain("Netzwerkfehler");
  });

  it("TimeoutError hat Default-Message", () => {
    const err = new TimeoutError();
    expect(err.name).toBe("TimeoutError");
    expect(err.message).toContain("zu lange");
  });
});

describe("optimistic()", () => {
  it("wendet Change an und behält bei Erfolg", async () => {
    let value = "original";
    const apply = () => { value = "optimistic"; };
    const revert = () => { value = "original"; };
    globalThis.fetch = mockFetchSuccess({ ok: true });

    const result = await optimistic(apply, revert, () =>
      api.patch("/api/test", {}, { retries: 0 }),
    );

    expect(value).toBe("optimistic");
    expect(result.error).toBeNull();
  });

  it("reverted bei Fehler", async () => {
    let value = "original";
    const apply = () => { value = "optimistic"; };
    const revert = () => { value = "original"; };
    globalThis.fetch = mockFetchError({ error: "Nope" }, 400);

    const result = await optimistic(apply, revert, () =>
      api.patch("/api/test", {}, { retries: 0 }),
    );

    expect(value).toBe("original");
    expect(result.error).toBe("Nope");
  });
});
