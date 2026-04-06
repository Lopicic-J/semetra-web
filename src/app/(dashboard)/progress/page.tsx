import { redirect } from "next/navigation";

// Consolidated into /studium hub — redirect to overview tab
export default function ProgressPage() {
  redirect("/studium?tab=uebersicht");
}
