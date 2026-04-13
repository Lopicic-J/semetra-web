/**
 * Webhook Utilities — HMAC Signing & Verification
 *
 * Used for both inbound (verify external senders) and outbound (sign our payloads).
 *
 * Signature format: sha256=<hex>
 * Header: X-Semetra-Signature
 */

import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_HEADER = "x-semetra-signature";
const ALGORITHM = "sha256";

/**
 * Create HMAC signature for a payload.
 */
export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac(ALGORITHM, secret);
  hmac.update(payload, "utf8");
  return `${ALGORITHM}=${hmac.digest("hex")}`;
}

/**
 * Verify an HMAC signature against a payload.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expected = signPayload(payload, secret);

  // Timing-safe comparison
  try {
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Deliver a webhook payload to a URL with HMAC signature.
 * Returns delivery result for logging.
 */
export async function deliverWebhook(
  url: string,
  event: string,
  payload: Record<string, unknown>,
  secret: string,
  options?: { timeoutMs?: number; retries?: number }
): Promise<{
  success: boolean;
  statusCode: number | null;
  error: string | null;
  duration: number;
  attempt: number;
}> {
  const maxRetries = options?.retries ?? 3;
  const timeout = options?.timeoutMs ?? 10000;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = signPayload(body, secret);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Semetra-Signature": signature,
          "X-Semetra-Event": event,
          "User-Agent": "Semetra-Webhook/1.0",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);
      const duration = Date.now() - start;

      if (res.ok || res.status < 500) {
        return {
          success: res.ok,
          statusCode: res.status,
          error: res.ok ? null : `HTTP ${res.status}`,
          duration,
          attempt,
        };
      }

      // 5xx → retry
      if (attempt === maxRetries) {
        return {
          success: false,
          statusCode: res.status,
          error: `HTTP ${res.status} after ${maxRetries} attempts`,
          duration,
          attempt,
        };
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    } catch (err) {
      const duration = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      if (attempt === maxRetries) {
        return {
          success: false,
          statusCode: null,
          error: errorMsg,
          duration,
          attempt,
        };
      }

      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  return { success: false, statusCode: null, error: "Max retries exceeded", duration: 0, attempt: maxRetries };
}

export { SIGNATURE_HEADER };
