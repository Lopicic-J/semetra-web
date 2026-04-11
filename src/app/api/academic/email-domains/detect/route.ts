import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  getUniversityEntryFromEmail,
  type UniversityDomainEntry,
} from "@/lib/university-domains";

const log = logger("api:email-domains:detect");

/**
 * POST /api/academic/email-domains/detect
 *
 * Public endpoint (no auth required). Called during registration.
 *
 * Given an email, detects the institution via:
 * 1. Static domain map (university-domains.ts)
 * 2. DB domains (exact match)
 * 3. DB domains (parent-domain match, e.g., students.ffhs.ch → ffhs.ch)
 *
 * If a match is found via parent-domain, the exact subdomain is
 * auto-inserted into institution_email_domains for future exact matches
 * and admin visibility.
 *
 * Returns: { match: true/false, institution_id, institution_name, institution_code, source }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ match: false });
    }

    const domain = email.split("@")[1];
    if (!domain) return NextResponse.json({ match: false });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      // Fallback: static map only
      const staticEntry = getUniversityEntryFromEmail(email);
      if (staticEntry) {
        return NextResponse.json({
          match: true,
          institution_name: staticEntry.name,
          institution_code: staticEntry.code,
          institution_id: null,
          source: "static",
        });
      }
      return NextResponse.json({ match: false });
    }

    const supabase = createClient(url, key);

    // ── 1. Check static map first ──
    const staticEntry: UniversityDomainEntry | null = getUniversityEntryFromEmail(email);

    // ── 2. Check DB: exact domain match ──
    const { data: exactMatch } = await supabase
      .from("institution_email_domains")
      .select("domain, institution_id, institutions(id, name, code)")
      .eq("domain", domain)
      .limit(1)
      .single();

    if (exactMatch) {
      const instRaw = exactMatch.institutions;
      const inst = (Array.isArray(instRaw) ? instRaw[0] : instRaw) as Record<string, unknown> | null;
      return NextResponse.json({
        match: true,
        institution_id: exactMatch.institution_id,
        institution_name: (inst?.name as string) || staticEntry?.name || null,
        institution_code: (inst?.code as string) || staticEntry?.code || null,
        source: "db_exact",
      });
    }

    // ── 3. Check DB: parent-domain match ──
    // e.g., "students.ffhs.ch" → check "ffhs.ch", then parent parts
    const parts = domain.split(".");
    let parentMatch: Record<string, unknown> | null = null;

    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join(".");
      const { data } = await supabase
        .from("institution_email_domains")
        .select("domain, institution_id, institutions(id, name, code)")
        .eq("domain", parentDomain)
        .limit(1)
        .single();
      if (data) {
        parentMatch = data as Record<string, unknown>;
        break;
      }
    }

    if (parentMatch) {
      const pmInstRaw = parentMatch.institutions;
      const inst = (Array.isArray(pmInstRaw) ? pmInstRaw[0] : pmInstRaw) as Record<string, unknown> | null;
      const institutionId = parentMatch.institution_id as string;

      // Auto-insert the new subdomain for future exact matches & admin visibility
      const { error: insertErr } = await supabase
        .from("institution_email_domains")
        .insert({
          institution_id: institutionId,
          domain: domain,
          auto_detected: true,
          created_by: null, // system-generated
        })
        .select()
        .single();

      if (insertErr && insertErr.code !== "23505") {
        // 23505 = unique violation (domain already exists), which is fine
        log.warn("Auto-insert subdomain failed", { domain, error: insertErr });
      } else if (!insertErr) {
        log.info("Auto-detected subdomain added", { domain, parent: parentMatch.domain, institution_id: institutionId });
      }

      return NextResponse.json({
        match: true,
        institution_id: institutionId,
        institution_name: (inst?.name as string) || null,
        institution_code: (inst?.code as string) || null,
        source: "db_parent",
        auto_added_domain: domain,
      });
    }

    // ── 4. Static map fallback (no DB match) ──
    if (staticEntry) {
      // Try to resolve institution_id from static code
      const { data: instByCode } = await supabase
        .from("institutions")
        .select("id, name, code")
        .ilike("code", staticEntry.code)
        .limit(1)
        .single();

      // Auto-insert domain into DB so it shows up in admin panel
      if (instByCode) {
        const { error: insertErr } = await supabase
          .from("institution_email_domains")
          .insert({
            institution_id: instByCode.id,
            domain: domain,
            auto_detected: true,
            created_by: null,
          })
          .select()
          .single();

        if (insertErr && insertErr.code !== "23505") {
          log.warn("Auto-insert from static map failed", { domain, error: insertErr });
        } else if (!insertErr) {
          log.info("Static map domain auto-added to DB", { domain, institution: instByCode.code });
        }
      }

      return NextResponse.json({
        match: true,
        institution_id: instByCode?.id || null,
        institution_name: instByCode?.name || staticEntry.name,
        institution_code: instByCode?.code || staticEntry.code,
        source: "static",
      });
    }

    // ── 5. No match found ──
    return NextResponse.json({ match: false });
  } catch (err) {
    log.error("Detection failed", { error: err });
    return NextResponse.json({ match: false });
  }
}
