import { redirect } from "next/navigation";

// Consolidated into /studium hub — redirect to grades tab
export default function GradesPage() {
  redirect("/studium?tab=noten");
}
