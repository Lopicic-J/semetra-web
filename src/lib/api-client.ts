/**
 * Zentraler API-Client mit Retry, Error-Handling und Toast-Feedback.
 *
 * Verwendung:
 *   import { api } from "@/lib/api-client";
 *   const { data, error } = await api.get<MyType>("/api/modules");
 *   const { data, error } = await api.post("/api/modules", { name: "..." });
 *   const { data, error } = await api.patch("/api/modules/123", { name: "..." });
 *   const { data, error } = await api.del("/api/modules/123");
 */

import toast from "react-hot-toast";

/** Helper to capture exceptions in Sentry if available */
function captureSentryException(error: Error | string, context?: Record<string, any>) {
  if (typeof window !== "undefined" && (window as any).__SENTRY__?.captureException) {
    const err = typeof error === "string" ? new Error(error) : error;
    (window as any).__SENTRY__.captureException(err, { contexts: { api: context } });
  }
}

/* ─── Types ─── */

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface ApiOptions {
  /** Retry count for network errors (default: 2) */
  retries?: number;
  /** Show toast on error (default: true) */
  showErrorToast?: boolean;
  /** Show toast on success (default: false) */
  showSuccessToast?: boolean;
  /** Custom success message */
  successMessage?: string;
  /** Custom error message (overrides server error) */
  errorMessage?: string;
  /** Timeout in ms (default: 15000) */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Signal for abort controller */
  signal?: AbortSignal;
}

/* ─── Error Classes ─── */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public serverMessage?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Netzwerkfehler — bitte Verbindung prüfen") {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string = "Anfrage hat zu lange gedauert") {
    super(message);
    this.name = "TimeoutError";
  }
}

/* ─── Helpers ─── */

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAYS = [500, 1500, 3000]; // exponential-ish backoff

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Translate common HTTP status codes to German user-friendly messages */
function statusMessage(status: number): string {
  switch (status) {
    case 400: return "Ungültige Anfrage";
    case 401: return "Nicht autorisiert — bitte erneut anmelden";
    case 403: return "Zugriff verweigert";
    case 404: return "Nicht gefunden";
    case 409: return "Konflikt — Daten wurden zwischenzeitlich geändert";
    case 422: return "Ungültige Daten";
    case 429: return "Zu viele Anfragen — bitte kurz warten";
    default:
      if (status >= 500) return "Serverfehler — bitte später erneut versuchen";
      return `Fehler (${status})`;
  }
}

/* ─── Core Request Function ─── */

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  options: ApiOptions = {},
): Promise<ApiResponse<T>> {
  const {
    retries = DEFAULT_RETRIES,
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    errorMessage,
    timeout = DEFAULT_TIMEOUT,
    headers: extraHeaders = {},
    signal,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Timeout via AbortController
      const controller = new AbortController();
      const combinedSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;
      const timer = setTimeout(() => controller.abort(), timeout);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...extraHeaders,
      };

      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: combinedSignal,
      });

      clearTimeout(timer);

      // Parse response
      let data: T | null = null;
      let serverError: string | null = null;

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (res.ok) {
          data = json as T;
        } else {
          serverError = json?.error ?? json?.message ?? statusMessage(res.status);
        }
      } else if (res.ok) {
        // Non-JSON success (e.g., 204 No Content)
        data = null as T;
      }

      if (!res.ok) {
        // Retry on retryable status codes
        if (isRetryable(res.status) && attempt < retries) {
          lastError = new ApiError(serverError ?? statusMessage(res.status), res.status);
          await delay(RETRY_DELAYS[attempt] ?? 3000);
          continue;
        }

        const msg = errorMessage ?? serverError ?? statusMessage(res.status);
        captureSentryException(msg, { method, url, status: res.status, attempt });
        if (showErrorToast) toast.error(msg);
        return { data: null, error: msg, status: res.status };
      }

      // Success
      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return { data, error: null, status: res.status };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (signal?.aborted) {
          // User-initiated cancel — no toast
          return { data: null, error: "Abgebrochen", status: 0 };
        }
        // Timeout
        lastError = new TimeoutError();
        if (attempt < retries) {
          await delay(RETRY_DELAYS[attempt] ?? 3000);
          continue;
        }
        captureSentryException(lastError, { method, url, type: "timeout", attempt });
      } else {
        lastError = new NetworkError();
        if (attempt < retries) {
          await delay(RETRY_DELAYS[attempt] ?? 3000);
          continue;
        }
        captureSentryException(lastError, { method, url, type: "network", attempt });
      }
    }
  }

  // All retries exhausted
  const msg = errorMessage ?? lastError?.message ?? "Unbekannter Fehler";
  captureSentryException(lastError ?? msg, { method, url, retriesExhausted: true });
  if (showErrorToast) toast.error(msg);
  return { data: null, error: msg, status: 0 };
}

/* ─── Public API ─── */

export const api = {
  get<T>(url: string, options?: ApiOptions) {
    return request<T>("GET", url, undefined, options);
  },

  post<T>(url: string, body?: unknown, options?: ApiOptions) {
    return request<T>("POST", url, body, options);
  },

  patch<T>(url: string, body?: unknown, options?: ApiOptions) {
    return request<T>("PATCH", url, body, options);
  },

  put<T>(url: string, body?: unknown, options?: ApiOptions) {
    return request<T>("PUT", url, body, options);
  },

  del<T>(url: string, body?: unknown, options?: ApiOptions) {
    return request<T>("DELETE", url, body, options);
  },
};

/* ─── Utility: Optimistic Update Helper ─── */

/**
 * Optimistic update pattern — applies change immediately, reverts on failure.
 *
 * Usage:
 *   await optimistic(
 *     () => setItems(prev => prev.map(i => i.id === id ? { ...i, done: true } : i)),
 *     () => setItems(prev => prev.map(i => i.id === id ? { ...i, done: false } : i)),
 *     () => api.patch(`/api/items/${id}`, { done: true }),
 *   );
 */
export async function optimistic<T>(
  apply: () => void,
  revert: () => void,
  action: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  apply();
  const result = await action();
  if (result.error) {
    revert();
  }
  return result;
}
