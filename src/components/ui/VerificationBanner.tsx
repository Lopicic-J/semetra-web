"use client";

import { useProfile } from "@/lib/hooks/useProfile";
import { AlertTriangle, Clock, XCircle, Mail } from "lucide-react";
import Link from "next/link";

/**
 * Banner shown to users who need verification.
 * - pending: "Dein Konto wird überprüft" + Hinweis auf Hochschul-Email
 * - rejected: "Verifizierung abgelehnt" + Hinweis Email ändern
 * - none (but role requires it): "Verifizierung erforderlich"
 *
 * Non-students and admins never see this banner.
 *
 * Seit 06.04.2026: Kein Dokumenten-Upload mehr — nur Email-Domain-Verifizierung.
 */
export function VerificationBanner() {
  const { profile, loading, userRole, verificationStatus } = useProfile();

  if (loading || !profile) return null;

  // Admins and non-students don't need verification
  if (userRole === "admin" || userRole === "non_student") return null;

  // Already verified
  if (verificationStatus === "verified") return null;

  if (verificationStatus === "pending") {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              Verifizierung ausstehend
            </p>
            <p className="text-xs text-amber-600">
              {userRole === "student"
                ? "Tipp: Verwende deine Hochschul-Email (@zhaw.ch, @ethz.ch, etc.) für sofortige Verifizierung. Alternativ prüft ein Admin deinen Antrag."
                : "Dein Institutions-Zugang wird eingerichtet. Bei Fragen kontaktiere uns unter kontakt@semetra.ch."}
            </p>
          </div>
          {userRole === "student" && (
            <Link
              href="/profile"
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition"
            >
              <Mail className="w-3.5 h-3.5" />
              Email ändern
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (verificationStatus === "rejected") {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              Verifizierung abgelehnt
            </p>
            <p className="text-xs text-red-600">
              {profile.verification_note
                ? `Grund: ${profile.verification_note}`
                : "Verwende deine Hochschul-Email für eine automatische Verifizierung."}
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition"
          >
            <Mail className="w-3.5 h-3.5" />
            Email ändern
          </Link>
        </div>
      </div>
    );
  }

  // Status "none" but role requires verification (student/institution without submitted request)
  if (verificationStatus === "none") {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-800">
              Verifizierung erforderlich
            </p>
            <p className="text-xs text-blue-600">
              {userRole === "student"
                ? "Verwende deine Hochschul-Email (@zhaw.ch, @ethz.ch, etc.) um alle Funktionen freizuschalten."
                : "Kontaktiere uns unter kontakt@semetra.ch für die Einrichtung deines Institutions-Zugangs."}
            </p>
          </div>
          {userRole === "student" && (
            <Link
              href="/profile"
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition"
            >
              <Mail className="w-3.5 h-3.5" />
              Email ändern
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}
