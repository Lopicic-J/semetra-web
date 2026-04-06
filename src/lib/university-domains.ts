/**
 * Bekannte Schweizer Hochschul-Email-Domains.
 *
 * Wird verwendet um Studenten automatisch zu verifizieren:
 * Registriert sich jemand mit einer @zhaw.ch Email als Student,
 * wird der Account sofort als "verified" markiert.
 *
 * Diese Liste kann über das Admin-Dashboard erweitert werden (Zukunft).
 * Aktuell: Statische Konfiguration der gängigsten CH-Hochschulen.
 */

export const KNOWN_UNIVERSITY_DOMAINS: Record<string, string> = {
  // ─── Fachhochschulen ─────────────────────────────────────────
  "zhaw.ch": "ZHAW",
  "students.zhaw.ch": "ZHAW",
  "fhnw.ch": "FHNW",
  "students.fhnw.ch": "FHNW",
  "bfh.ch": "BFH",
  "students.bfh.ch": "BFH",
  "hslu.ch": "HSLU",
  "stud.hslu.ch": "HSLU",
  "fhgr.ch": "FHGR",
  "ost.ch": "OST",
  "students.ost.ch": "OST",
  "hes-so.ch": "HES-SO",
  "supsi.ch": "SUPSI",

  // ─── Universitäten ───────────────────────────────────────────
  "ethz.ch": "ETH Zürich",
  "student.ethz.ch": "ETH Zürich",
  "uzh.ch": "Universität Zürich",
  "s.uzh.ch": "Universität Zürich",
  "unibe.ch": "Universität Bern",
  "students.unibe.ch": "Universität Bern",
  "unisg.ch": "Universität St. Gallen",
  "student.unisg.ch": "Universität St. Gallen",
  "unifr.ch": "Universität Fribourg",
  "unil.ch": "Universität Lausanne",
  "epfl.ch": "EPFL",
  "unibas.ch": "Universität Basel",
  "stud.unibas.ch": "Universität Basel",
  "unilu.ch": "Universität Luzern",
  "usi.ch": "USI",
  "unine.ch": "Universität Neuenburg",

  // ─── Pädagogische Hochschulen ────────────────────────────────
  "phzh.ch": "PH Zürich",
  "phbern.ch": "PH Bern",
  "phtg.ch": "PH Thurgau",
  "phsg.ch": "PH St. Gallen",
  "phlu.ch": "PH Luzern",
  "phzg.ch": "PH Zug",
  "phsz.ch": "PH Schwyz",

  // ─── Kunst / Musik ──────────────────────────────────────────
  "zhdk.ch": "ZHdK",
  "hkb.bfh.ch": "HKB",
};

/**
 * Prüft ob eine Email-Adresse zu einer bekannten Hochschule gehört.
 * Gibt den Hochschulnamen zurück oder null.
 *
 * Prüft exakte Domain und übergeordnete Domains:
 * - "max@students.zhaw.ch" → matches "students.zhaw.ch" → "ZHAW"
 * - "max@zhaw.ch" → matches "zhaw.ch" → "ZHAW"
 * - "max@sub.students.zhaw.ch" → matches via parent "students.zhaw.ch" → "ZHAW"
 */
export function getUniversityFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Exakte Domain prüfen
  if (KNOWN_UNIVERSITY_DOMAINS[domain]) {
    return KNOWN_UNIVERSITY_DOMAINS[domain];
  }

  // Subdomain-Check: Übergeordnete Domains durchprobieren
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (KNOWN_UNIVERSITY_DOMAINS[parent]) {
      return KNOWN_UNIVERSITY_DOMAINS[parent];
    }
  }

  return null;
}

/**
 * Convenience: Gibt true zurück wenn die Email zu einer Hochschule gehört.
 */
export function isUniversityEmail(email: string): boolean {
  return getUniversityFromEmail(email) !== null;
}

/**
 * Extrahiert die Domain einer Email-Adresse.
 */
export function getEmailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}
