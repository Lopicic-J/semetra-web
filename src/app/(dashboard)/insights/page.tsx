import { redirect } from "next/navigation";

// Insights hub aufgelöst — Features sind jetzt eigenständige Seiten:
// /weekly-review, /trends, /patterns, /timeline
export default function InsightsPage() {
  redirect("/review");
}
