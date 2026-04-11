import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const log = logger("api:academic:email-domains");

/**
 * GET /api/academic/email-domains
 *
 * Public endpoint (no auth required) that returns all institution email domains.
 * Used by the registration page to detect institutions from email addresses.
 *
 * Returns: { domains: [{ domain, institution_id, institution_name, institution_code }] }
 */
export async function GET(_req: NextRequest) {
  try {
    // Use service client to bypass RLS (this is a public read-only endpoint)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ domains: [] });
    }
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("institution_email_domains")
      .select("domain, institution_id, institutions(id, name, code)")
      .order("domain");

    if (error) {
      log.error("GET failed", { error });
      return NextResponse.json({ domains: [] });
    }

    const domains = (data || []).map((d: Record<string, unknown>) => {
      const inst = d.institutions as Record<string, unknown> | null;
      return {
        domain: d.domain as string,
        institution_id: d.institution_id as string,
        institution_name: (inst?.name as string) || null,
        institution_code: (inst?.code as string) || null,
      };
    });

    return NextResponse.json({ domains });
  } catch (err) {
    log.error("GET failed", { error: err });
    return NextResponse.json({ domains: [] });
  }
}
