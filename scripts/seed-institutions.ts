#!/usr/bin/env npx tsx
/**
 * Admin Seed Script — DACH Hochschul-Daten
 *
 * Wiederholbares Script zum Befüllen der institutions/programs-Tabellen.
 * Idempotent: benutzt ON CONFLICT (id) DO NOTHING für alle Inserts.
 *
 * Usage:
 *   npx tsx scripts/seed-institutions.ts
 *
 * Alternativ: Die SQL-Migration 043_dach_university_seed.sql kann direkt
 * über die Supabase CLI ausgeführt werden:
 *   npx supabase db push
 *
 * Datenquellen:
 *   - swissuniversities (CH): Alle ECTS-akkreditierten Schweizer Hochschulen
 *   - HRK Hochschulkompass (DE): Top-20 Universitäten + Top-10 Fachhochschulen
 *   - Studieren.at (AT): Alle öffentlichen Universitäten + alle 14 FHs
 *
 * Abdeckung:
 *   CH: 12 Universitäten + 10 FHs = 22 Institutionen, ~109 Studiengänge
 *   DE: 20 Universitäten + 10 FHs = 30 Institutionen, ~151 Studiengänge
 *   AT: 12 Universitäten + 14 FHs = 26 Institutionen, ~106 Studiengänge
 *   TOTAL: 78 Institutionen, 366 Studiengänge
 *
 * Plus die 7 Institutionen aus Migration 039 (Demo-Seed):
 *   ZHAW (CH), TUM (DE), TU Delft (NL), Politecnico di Milano (IT),
 *   UPM (ES), Sorbonne (FR), Univ. Edinburgh (UK)
 *
 * Gesamtbestand nach Seed: 85 Institutionen, ~373 Studiengänge
 */

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║  Semetra DACH Hochschul-Seed                        ║");
console.log("║  78 Institutionen | 366 Studiengänge                ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log();
console.log("Dieses Script dokumentiert die Datenstruktur.");
console.log("Die eigentliche Befüllung erfolgt via SQL-Migration:");
console.log("  supabase/migrations/043_dach_university_seed.sql");
console.log();
console.log("Zum Ausführen:");
console.log("  npx supabase db push");
console.log("  # oder");
console.log("  npx supabase migration up");
console.log();
console.log("Abdeckung:");
console.log("  CH: ETH Zürich, EPFL, UZH, UniBE, UniBS, UNIL, UNIGE, HSG,");
console.log("      UniLU, UniFR, USI, UniNE, FHNW, BFH, HSLU, HES-SO,");
console.log("      SUPSI, OST, FFHS, FHGR, Kalaidos, ZHdK");
console.log("  DE: LMU, Heidelberg, HU Berlin, FU Berlin, TU Berlin, RWTH,");
console.log("      Freiburg, Tübingen, Göttingen, KIT, TU Dresden, Hamburg,");
console.log("      Köln, Bonn, Stuttgart, Münster, Frankfurt, TU Darmstadt,");
console.log("      Mannheim, FAU + TH Köln, HAW Hamburg, FH Aachen, HS München,");
console.log("      HS Karlsruhe, HTW Berlin, HS Darmstadt, FH Dortmund,");
console.log("      HS RheinMain, HS Esslingen");
console.log("  AT: Uni Wien, TU Wien, WU Wien, Uni Graz, TU Graz, Uni Innsbruck,");
console.log("      Uni Salzburg, JKU Linz, MedUni Wien, BOKU, MU Leoben,");
console.log("      Uni Klagenfurt + 14 FHs (Campus Wien, Technikum Wien, etc.)");
