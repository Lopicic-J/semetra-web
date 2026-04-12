import { redirect } from "next/navigation";

// Fortschritt hub aufgelöst — Features sind jetzt eigenständige Seiten:
// /lern-dna, /patterns, /trends, /timeline, /weekly-review, /achievements, /leaderboard
export default function FortschrittPage() {
  redirect("/dna");
}
