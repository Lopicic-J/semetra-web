/**
 * Bekannte Schweizer Hochschul-Email-Domains.
 *
 * Wird verwendet um:
 * 1. Studenten automatisch zu verifizieren (Uni-Email → verified)
 * 2. Die Institution automatisch zuzuweisen (Hard-Lock)
 *
 * `name` = Anzeigename für UI-Feedback
 * `code` = Institutions-Code in der DB (institutions.code)
 *          Wird verwendet um die institution_id aufzulösen
 *
 * Diese Liste kann über das Admin-Dashboard erweitert werden (Zukunft).
 * Aktuell: Statische Konfiguration der gängigsten CH-Hochschulen.
 */

export interface UniversityDomainEntry {
  name: string;
  code: string;  // Matches institutions.code in Supabase
}

export const KNOWN_UNIVERSITY_DOMAINS: Record<string, UniversityDomainEntry> = {
  // ─── Fachhochschulen ─────────────────────────────────────────
  "zhaw.ch":           { name: "ZHAW", code: "ZHAW" },
  "students.zhaw.ch":  { name: "ZHAW", code: "ZHAW" },
  "fhnw.ch":           { name: "FHNW", code: "FHNW" },
  "students.fhnw.ch":  { name: "FHNW", code: "FHNW" },
  "bfh.ch":            { name: "BFH", code: "BFH" },
  "students.bfh.ch":   { name: "BFH", code: "BFH" },
  "hslu.ch":           { name: "HSLU", code: "HSLU" },
  "stud.hslu.ch":      { name: "HSLU", code: "HSLU" },
  "fhgr.ch":           { name: "FHGR", code: "FHGR" },
  "ost.ch":            { name: "OST", code: "OST" },
  "students.ost.ch":   { name: "OST", code: "OST" },
  "hes-so.ch":         { name: "HES-SO", code: "HES-SO" },
  "supsi.ch":          { name: "SUPSI", code: "SUPSI" },
  "ffhs.ch":           { name: "FFHS", code: "FFHS" },
  "students.ffhs.ch":  { name: "FFHS", code: "FFHS" },

  // ─── Universitäten ───────────────────────────────────────────
  "ethz.ch":           { name: "ETH Zürich", code: "ETHZ" },
  "student.ethz.ch":   { name: "ETH Zürich", code: "ETHZ" },
  "uzh.ch":            { name: "Universität Zürich", code: "UZH" },
  "s.uzh.ch":          { name: "Universität Zürich", code: "UZH" },
  "unibe.ch":          { name: "Universität Bern", code: "UNIBE" },
  "students.unibe.ch": { name: "Universität Bern", code: "UNIBE" },
  "unisg.ch":          { name: "Universität St. Gallen", code: "UNISG" },
  "student.unisg.ch":  { name: "Universität St. Gallen", code: "UNISG" },
  "unifr.ch":          { name: "Universität Fribourg", code: "UNIFR" },
  "unil.ch":           { name: "Universität Lausanne", code: "UNIL" },
  "epfl.ch":           { name: "EPFL", code: "EPFL" },
  "unibas.ch":         { name: "Universität Basel", code: "UNIBAS" },
  "stud.unibas.ch":    { name: "Universität Basel", code: "UNIBAS" },
  "unilu.ch":          { name: "Universität Luzern", code: "UNILU" },
  "usi.ch":            { name: "USI", code: "USI" },
  "unine.ch":          { name: "Universität Neuenburg", code: "UNINE" },

  // ─── Pädagogische Hochschulen ────────────────────────────────
  "phzh.ch":           { name: "PH Zürich", code: "PHZH" },
  "phbern.ch":         { name: "PH Bern", code: "PHBERN" },
  "phtg.ch":           { name: "PH Thurgau", code: "PHTG" },
  "phsg.ch":           { name: "PH St. Gallen", code: "PHSG" },
  "phlu.ch":           { name: "PH Luzern", code: "PHLU" },
  "phzg.ch":           { name: "PH Zug", code: "PHZG" },
  "phsz.ch":           { name: "PH Schwyz", code: "PHSZ" },

  // ─── Kunst / Musik ──────────────────────────────────────────
  "zhdk.ch":           { name: "ZHdK", code: "ZHDK" },
  "hkb.bfh.ch":        { name: "HKB", code: "HKB" },
};

/**
 * Interne Hilfsfunktion: Findet den Domain-Eintrag für eine Email.
 */
function findDomainEntry(email: string): UniversityDomainEntry | null {
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
 * Prüft ob eine Email-Adresse zu einer bekannten Hochschule gehört.
 * Gibt den Hochschulnamen zurück oder null.
 *
 * Prüft exakte Domain und übergeordnete Domains:
 * - "max@students.zhaw.ch" → matches "students.zhaw.ch" → "ZHAW"
 * - "max@zhaw.ch" → matches "zhaw.ch" → "ZHAW"
 * - "max@sub.students.zhaw.ch" → matches via parent "students.zhaw.ch" → "ZHAW"
 */
export function getUniversityFromEmail(email: string): string | null {
  return findDomainEntry(email)?.name ?? null;
}

/**
 * Gibt den Institutions-Code (institutions.code) für eine Email zurück.
 * Wird verwendet um die institution_id aus der DB aufzulösen.
 *
 * z.B. "max@students.zhaw.ch" → "ZHAW"
 */
export function getInstitutionCodeFromEmail(email: string): string | null {
  return findDomainEntry(email)?.code ?? null;
}

/**
 * Gibt den vollständigen Eintrag (name + code) zurück.
 */
export function getUniversityEntryFromEmail(email: string): UniversityDomainEntry | null {
  return findDomainEntry(email);
}

/**
 * Convenience: Gibt true zurück wenn die Email zu einer Hochschule gehört.
 */
export function isUniversityEmail(email: string): boolean {
  return findDomainEntry(email) !== null;
}

/**
 * Extrahiert die Domain einer Email-Adresse.
 */
export function getEmailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}
