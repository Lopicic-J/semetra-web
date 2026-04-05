import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const log = logger("academic:reference");

/**
 * GET /api/academic/reference
 *
 * Returns all reference data (credit_schemes, grade_scales, pass_policies, retake_policies,
 * rounding_policies, classification_schemes, gpa_schemes, country_systems) in one call.
 *
 * Cached, no auth required for read.
 * Response is cached via HTTP headers (public, max-age=3600).
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const [
      creditSchemesData,
      gradeScalesData,
      gradeBandsData,
      passPoliciesData,
      retakePoliciesData,
      roundingPoliciesData,
      classificationSchemesData,
      gpaSchemesData,
      countrySystemsData,
    ] = await Promise.all([
      supabase.from("credit_schemes").select("*"),
      supabase.from("grade_scales").select("*"),
      supabase.from("grade_bands").select("*"),
      supabase.from("pass_policies").select("*"),
      supabase.from("retake_policies").select("*"),
      supabase.from("rounding_policies").select("*"),
      supabase.from("classification_schemes").select("*"),
      supabase.from("gpa_schemes").select("*"),
      supabase.from("country_systems").select("*"),
    ]);

    // Check for errors
    if (
      creditSchemesData.error ||
      gradeScalesData.error ||
      gradeBandsData.error ||
      passPoliciesData.error ||
      retakePoliciesData.error ||
      roundingPoliciesData.error ||
      classificationSchemesData.error ||
      gpaSchemesData.error ||
      countrySystemsData.error
    ) {
      log.error("Error fetching reference data", {
        creditSchemesError: creditSchemesData.error?.message,
        gradeScalesError: gradeScalesData.error?.message,
        gradeBandsError: gradeBandsData.error?.message,
        passPoliciesError: passPoliciesData.error?.message,
        retakePoliciesError: retakePoliciesData.error?.message,
        roundingPoliciesError: roundingPoliciesData.error?.message,
        classificationSchemesError: classificationSchemesData.error?.message,
        gpaSchemesError: gpaSchemesData.error?.message,
        countrySystemsError: countrySystemsData.error?.message,
      });
      return NextResponse.json(
        { error: "Fehler beim Abrufen von Referenzdaten" },
        { status: 500 }
      );
    }

    const response = {
      creditSchemes: creditSchemesData.data || [],
      gradeScales: gradeScalesData.data || [],
      gradeBands: gradeBandsData.data || [],
      passPolicies: passPoliciesData.data || [],
      retakePolicies: retakePoliciesData.data || [],
      roundingPolicies: roundingPoliciesData.data || [],
      classificationSchemes: classificationSchemesData.data || [],
      gpaSchemes: gpaSchemesData.data || [],
      countrySystems: countrySystemsData.data || [],
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err: unknown) {
    log.error("[academic/reference]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
