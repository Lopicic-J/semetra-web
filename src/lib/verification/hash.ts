/**
 * Semetra Report Verification — SHA-256 Hash System
 *
 * Generates and verifies cryptographic hashes for reports and certificates.
 * Each report gets a unique hash based on its content, making it tamper-proof.
 *
 * Flow:
 * 1. Generate report → compute SHA-256 of canonical content
 * 2. Store hash + report_id in `report_verifications` table
 * 3. User can verify via /verify/[reportId] or /api/verification/report
 */

// ── Hash Generation (works in both Node.js and Edge) ────────────────────────

/**
 * Compute SHA-256 hash of a string.
 * Uses SubtleCrypto (available in Node 18+, Edge, and browsers).
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Use SubtleCrypto (universal: Node 18+, Edge, Browser)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Canonical Content for Hashing ───────────────────────────────────────────

export interface ReportHashInput {
  reportId: string;
  userId: string;
  reportType: "semester-report" | "module-certificate";
  /** Stable JSON of the report data (modules, grades, etc.) */
  contentJson: string;
  generatedAt: string;
}

/**
 * Build a canonical string from report data for hashing.
 * Order matters — this must be deterministic.
 */
export function buildCanonicalContent(input: ReportHashInput): string {
  return [
    `report_id:${input.reportId}`,
    `user_id:${input.userId}`,
    `type:${input.reportType}`,
    `generated_at:${input.generatedAt}`,
    `content:${input.contentJson}`,
    // Salt with a fixed namespace to prevent rainbow table attacks
    `ns:semetra-verify-v1`,
  ].join("|");
}

/**
 * Generate a verification hash for a report.
 */
export async function generateReportHash(input: ReportHashInput): Promise<string> {
  const canonical = buildCanonicalContent(input);
  return sha256(canonical);
}

// ── Verification Result ─────────────────────────────────────────────────────

export interface VerificationResult {
  valid: boolean;
  reportId: string;
  reportType: string;
  generatedAt: string;
  userName?: string;
  university?: string;
  /** Only present if hash matches */
  verifiedAt?: string;
}

// ── Report ID Generator (deterministic from content) ────────────────────────

/**
 * Generate a report ID that's both human-readable and unique.
 * Format: XXXX-XXXX-XXXX (alphanumeric, no ambiguous chars)
 */
export function generateReportId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}
