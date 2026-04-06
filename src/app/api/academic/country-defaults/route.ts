import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { requireAuth, errorResponse, createServiceClient } from "@/lib/api-helpers";

const log = logger("api:country-defaults");

/**
 * GET /api/academic/country-defaults?country=CH
 *
 * Fetch all academic defaults for a given country code.
 * Returns the country_systems row with all resolved FK references,
 * plus all available reference data (credit_schemes, grade_scales, etc.).
 *
 * Accessible to ALL authenticated users (for enrollment flows).
 *
 * Query params:
 * - country (required): ISO country code (e.g., "CH", "DE", "AT")
 * - institution_id (optional): Include institution-specific custom entries
 *
 * Response:
 * {
 *   defaults: {
 *     country_code: string
 *     name: string
 *     flag: string
 *     credit_scheme: { id, code, name, ... }
 *     grade_scale: { id, code, name, ... }
 *     rounding_policy: { id, code, name, ... }
 *     pass_policy: { id, code, name, ... }
 *     retake_policy: { id, code, name, ... }
 *     calendar_type: string
 *     uses_honours: boolean
 *   }
 *   creditSchemes: { id, code, name }[]
 *   gradeScales: { id, code, name }[] (filtered by country)
 *   roundingPolicies: { id, code, name }[]
 *   passPolicies: { id, code, name }[]
 *   retakePolicies: { id, code, name }[]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication (any authenticated user can read country defaults)
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // Use service client to bypass RLS on reference tables
    const supabase = createServiceClient();

    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");
    const institutionId = searchParams.get("institution_id");

    if (!country) {
      return errorResponse("Ländercode ist erforderlich", 400);
    }

    // 1. Fetch country_systems row for the given country_code
    const { data: countrySystem, error: countryError } = await supabase
      .from("country_systems")
      .select("*")
      .eq("country_code", country)
      .single();

    if (countryError || !countrySystem) {
      log.warn("Country not found", { country, error: countryError });
      return errorResponse(`Land mit Code ${country} nicht gefunden`, 404);
    }

    // 2. Fetch referenced objects by their IDs (in parallel)
    // Using select("*") to gracefully handle columns that may not exist yet
    // (e.g., description, institution_id added by migration 070)
    const [
      creditSchemeResult,
      gradeScaleResult,
      roundingPolicyResult,
      passPolicyResult,
      retakePolicyResult,
    ] = await Promise.all([
      countrySystem.default_credit_scheme_id
        ? supabase
            .from("credit_schemes")
            .select("*")
            .eq("id", countrySystem.default_credit_scheme_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      countrySystem.default_grade_scale_id
        ? supabase
            .from("grade_scales")
            .select("*")
            .eq("id", countrySystem.default_grade_scale_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      countrySystem.default_rounding_policy_id
        ? supabase
            .from("rounding_policies")
            .select("*")
            .eq("id", countrySystem.default_rounding_policy_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      countrySystem.default_pass_policy_id
        ? supabase
            .from("pass_policies")
            .select("*")
            .eq("id", countrySystem.default_pass_policy_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      countrySystem.default_retake_policy_id
        ? supabase
            .from("retake_policies")
            .select("*")
            .eq("id", countrySystem.default_retake_policy_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // 3. Fetch ALL grade_scales for that country (for dropdowns)
    const { data: allGradeScales, error: gradeScalesError } = await supabase
      .from("grade_scales")
      .select("*")
      .eq("country_code", country)
      .order("name");

    // 4. Fetch ALL universal reference data (not country-specific)
    const [
      allCreditSchemesResult,
      allRoundingPoliciesResult,
      allPassPoliciesResult,
      allRetakePoliciesResult,
    ] = await Promise.all([
      supabase
        .from("credit_schemes")
        .select("*")
        .order("name"),
      supabase
        .from("rounding_policies")
        .select("*")
        .order("name"),
      supabase
        .from("pass_policies")
        .select("*")
        .order("name"),
      supabase
        .from("retake_policies")
        .select("*")
        .order("name"),
    ]);

    // 5. If institution_id provided, fetch institution-specific custom entries
    let instGradeScales: typeof allGradeScales = [];
    let instRoundingPolicies: typeof allRoundingPoliciesResult.data = [];
    let instPassPolicies: typeof allPassPoliciesResult.data = [];
    let instRetakePolicies: typeof allRetakePoliciesResult.data = [];

    if (institutionId) {
      try {
        const [instGS, instRP, instPP, instReP] = await Promise.all([
          supabase
            .from("grade_scales")
            .select("*")
            .eq("institution_id", institutionId)
            .order("name"),
          supabase
            .from("rounding_policies")
            .select("*")
            .eq("institution_id", institutionId)
            .order("name"),
          supabase
            .from("pass_policies")
            .select("*")
            .eq("institution_id", institutionId)
            .order("name"),
          supabase
            .from("retake_policies")
            .select("*")
            .eq("institution_id", institutionId)
            .order("name"),
        ]);

        instGradeScales = instGS.data || [];
        instRoundingPolicies = instRP.data || [];
        instPassPolicies = instPP.data || [];
        instRetakePolicies = instReP.data || [];
      } catch (instErr) {
        // institution_id column may not exist yet (migration 070 not run)
        log.warn("Institution-specific reference queries failed (migration pending?)", { error: instErr });
      }
    }

    // Log errors but don't fail — return partial data so dropdowns still work
    const hasErrors =
      creditSchemeResult.error ||
      gradeScaleResult.error ||
      roundingPolicyResult.error ||
      passPolicyResult.error ||
      retakePolicyResult.error ||
      gradeScalesError ||
      allCreditSchemesResult.error ||
      allRoundingPoliciesResult.error ||
      allPassPoliciesResult.error ||
      allRetakePoliciesResult.error;

    if (hasErrors) {
      log.warn("Some country defaults queries had errors (returning partial data)", {
        creditSchemeError: creditSchemeResult.error?.message,
        gradeScaleError: gradeScaleResult.error?.message,
        roundingPolicyError: roundingPolicyResult.error?.message,
        passPolicyError: passPolicyResult.error?.message,
        retakePolicyError: retakePolicyResult.error?.message,
        gradeScalesError: gradeScalesError?.message,
        allCreditSchemesError: allCreditSchemesResult.error?.message,
        allRoundingPoliciesError: allRoundingPoliciesResult.error?.message,
        allPassPoliciesError: allPassPoliciesResult.error?.message,
        allRetakePoliciesError: allRetakePoliciesResult.error?.message,
      });
    }

    // 5. Construct the defaults object
    const defaults = {
      country_code: countrySystem.country_code,
      name: countrySystem.name,
      flag: countrySystem.flag,
      credit_scheme: creditSchemeResult.data || null,
      grade_scale: gradeScaleResult.data || null,
      rounding_policy: roundingPolicyResult.data || null,
      pass_policy: passPolicyResult.data || null,
      retake_policy: retakePolicyResult.data || null,
      calendar_type: countrySystem.calendar_type,
      uses_honours: countrySystem.uses_honours,
    };

    // Merge global + institution-specific entries (institution entries marked with _custom flag)
    const tagCustom = <T extends Record<string, unknown>>(items: T[]) =>
      items.map((item) => ({ ...item, _custom: true }));

    const response = {
      defaults,
      creditSchemes: allCreditSchemesResult.data || [],
      gradeScales: [
        ...(allGradeScales || []),
        ...tagCustom(instGradeScales || []),
      ],
      roundingPolicies: [
        ...(allRoundingPoliciesResult.data || []),
        ...tagCustom(instRoundingPolicies || []),
      ],
      passPolicies: [
        ...(allPassPoliciesResult.data || []),
        ...tagCustom(instPassPolicies || []),
      ],
      retakePolicies: [
        ...(allRetakePoliciesResult.data || []),
        ...tagCustom(instRetakePolicies || []),
      ],
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return errorResponse(
      err instanceof Error ? err.message : "Interner Fehler",
      500,
    );
  }
}
