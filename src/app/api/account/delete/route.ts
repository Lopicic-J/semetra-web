import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/account/delete
 * Permanently delete the authenticated user's account and all data.
 * Body: { confirmation: "KONTO LÖSCHEN" }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();

    // Require explicit confirmation string to prevent accidental deletion
    if (body.confirmation !== "KONTO LÖSCHEN") {
      return NextResponse.json(
        { error: "Bestätigung erforderlich. Bitte gib 'KONTO LÖSCHEN' ein." },
        { status: 400 }
      );
    }

    // Call the SECURITY DEFINER function that deletes all user data + auth record
    const { error } = await supabase.rpc("delete_own_account");

    if (error) {
      console.error("Account deletion failed:", error);
      return NextResponse.json(
        { error: "Kontolöschung fehlgeschlagen. Bitte kontaktiere den Support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Konto erfolgreich gelöscht" });
  } catch (err: unknown) {
    console.error("Account deletion error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 }
    );
  }
}
