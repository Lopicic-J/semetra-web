/**
 * /api/plugins/submissions — Plugin Review & Approval Pipeline
 *
 * Workflow: draft → submitted → under_review → approved / rejected → published
 *
 * GET:    List submissions (admin: all, user: own)
 * POST:   Submit a new plugin for review
 * PATCH:  Update submission status (admin only for review actions)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "published";

interface SubmissionRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  pricing_type: string;
  price_chf: number | null;
  source_url: string | null;
  config_schema: Record<string, unknown> | null;
  readme: string | null;
  status: SubmissionStatus;
  review_notes: string | null;
  reviewer_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ProfileRow {
  role: string;
}

const VALID_CATEGORIES = [
  "productivity",
  "grades",
  "calendar",
  "import-export",
  "social",
  "analytics",
  "ai",
  "other",
];

const VALID_PRICING = ["free", "premium"];

/**
 * GET — List plugin submissions
 * Admin sees all, regular users see only their own.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if admin
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileRaw as ProfileRow | null;
  const isAdmin = profile?.role === "admin";

  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("plugin_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  // Non-admins only see their own
  if (!isAdmin) {
    query = query.eq("user_id", user.id);
  }

  // Optional status filter
  if (status) {
    query = query.eq("status", status);
  }

  const { data: submissionsRaw, error } = await query;

  if (error) {
    console.error("[plugin-submissions] List error:", error);
    return NextResponse.json({ error: "Abfrage fehlgeschlagen" }, { status: 500 });
  }

  const submissions = (submissionsRaw ?? []) as SubmissionRow[];

  return NextResponse.json({ submissions, isAdmin });
}

/**
 * POST — Submit a new plugin for review
 *
 * Body: { name, slug, description, version, category, pricingType,
 *         priceCHF?, sourceUrl?, configSchema?, readme? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    slug,
    description,
    version,
    category,
    pricingType,
    priceCHF,
    sourceUrl,
    configSchema,
    readme,
  } = body;

  // Validation
  const errors: string[] = [];

  if (!name || typeof name !== "string" || name.length < 3) {
    errors.push("Name muss mindestens 3 Zeichen haben");
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.push("Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten");
  }
  if (!description || description.length < 10) {
    errors.push("Beschreibung muss mindestens 10 Zeichen haben");
  }
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push("Version muss im Format x.y.z sein");
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    errors.push(`Kategorie muss eine von: ${VALID_CATEGORIES.join(", ")} sein`);
  }
  if (!pricingType || !VALID_PRICING.includes(pricingType)) {
    errors.push("Preistyp muss 'free' oder 'premium' sein");
  }
  if (pricingType === "premium" && (!priceCHF || priceCHF <= 0)) {
    errors.push("Premium-Plugins benötigen einen Preis > 0");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validierung fehlgeschlagen", details: errors }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("plugin_submissions")
    .select("id")
    .eq("slug", slug)
    .neq("status", "rejected")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `Plugin-Slug "${slug}" ist bereits vergeben` },
      { status: 409 }
    );
  }

  // Also check against published plugins
  const { data: publishedExisting } = await supabase
    .from("plugins")
    .select("id")
    .eq("id", slug)
    .limit(1);

  if (publishedExisting && publishedExisting.length > 0) {
    return NextResponse.json(
      { error: `Plugin "${slug}" existiert bereits im Katalog` },
      { status: 409 }
    );
  }

  // Limit: max 3 pending submissions per user
  const { count } = await supabase
    .from("plugin_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["draft", "submitted", "under_review"]);

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Maximal 3 aktive Einreichungen erlaubt" },
      { status: 400 }
    );
  }

  const { data: submission, error: insertError } = await supabase
    .from("plugin_submissions")
    .insert({
      user_id: user.id,
      name,
      slug,
      description,
      version,
      category,
      pricing_type: pricingType,
      price_chf: pricingType === "premium" ? priceCHF : null,
      source_url: sourceUrl || null,
      config_schema: configSchema || null,
      readme: readme || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id, slug, status, submitted_at")
    .single();

  if (insertError) {
    console.error("[plugin-submissions] Insert error:", insertError);
    return NextResponse.json({ error: "Einreichung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ submission }, { status: 201 });
}

/**
 * PATCH — Update submission status (admin review actions)
 *
 * Body: { submissionId, action, reviewNotes? }
 *
 * Actions:
 *   - "start_review"       → submitted → under_review
 *   - "request_changes"    → under_review → changes_requested
 *   - "approve"            → under_review → approved
 *   - "reject"             → under_review → rejected
 *   - "publish"            → approved → published (creates plugin in catalog)
 *   - "resubmit"           → changes_requested → submitted (by author)
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { submissionId, action, reviewNotes } = await req.json();

  if (!submissionId || !action) {
    return NextResponse.json({ error: "submissionId und action erforderlich" }, { status: 400 });
  }

  // Fetch submission
  const { data: submissionRaw } = await supabase
    .from("plugin_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  const submission = submissionRaw as SubmissionRow | null;
  if (!submission) {
    return NextResponse.json({ error: "Einreichung nicht gefunden" }, { status: 404 });
  }

  // Check permissions
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileRaw as ProfileRow | null;
  const isAdmin = profile?.role === "admin";

  // Resubmit can be done by the author
  if (action === "resubmit") {
    if (submission.user_id !== user.id) {
      return NextResponse.json({ error: "Nur der Autor kann erneut einreichen" }, { status: 403 });
    }
    if (submission.status !== "changes_requested") {
      return NextResponse.json(
        { error: "Nur Einreichungen mit Änderungswunsch können erneut eingereicht werden" },
        { status: 400 }
      );
    }

    await supabase
      .from("plugin_submissions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", submissionId);

    return NextResponse.json({ ok: true, newStatus: "submitted" });
  }

  // All other actions require admin
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin-Berechtigung erforderlich" }, { status: 403 });
  }

  // State machine
  const transitions: Record<string, { from: SubmissionStatus; to: SubmissionStatus }> = {
    start_review: { from: "submitted", to: "under_review" },
    request_changes: { from: "under_review", to: "changes_requested" },
    approve: { from: "under_review", to: "approved" },
    reject: { from: "under_review", to: "rejected" },
    publish: { from: "approved", to: "published" },
  };

  const transition = transitions[action];
  if (!transition) {
    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  }

  if (submission.status !== transition.from) {
    return NextResponse.json(
      { error: `Aktion "${action}" nicht möglich im Status "${submission.status}"` },
      { status: 400 }
    );
  }

  // Update submission
  const updates: Record<string, unknown> = {
    status: transition.to,
    reviewer_id: user.id,
    reviewed_at: new Date().toISOString(),
  };
  if (reviewNotes) updates.review_notes = reviewNotes;

  await supabase.from("plugin_submissions").update(updates).eq("id", submissionId);

  // If publishing, create the actual plugin in the catalog
  if (action === "publish") {
    const { error: publishError } = await supabase.from("plugins").insert({
      id: submission.slug,
      name: submission.name,
      description: submission.description,
      version: submission.version,
      category: submission.category,
      pricing_type: submission.pricing_type,
      price_chf: submission.price_chf,
      config_schema: submission.config_schema,
      author_id: submission.user_id,
      active: true,
    });

    if (publishError) {
      console.error("[plugin-submissions] Publish error:", publishError);
      // Revert status
      await supabase
        .from("plugin_submissions")
        .update({ status: "approved" })
        .eq("id", submissionId);
      return NextResponse.json({ error: "Veröffentlichung fehlgeschlagen" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, newStatus: transition.to });
}
