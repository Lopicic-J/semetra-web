import { redirect } from "next/navigation";

// Consolidated into /studium hub — redirect to transcript tab (primary academic content)
export default function AcademicPage() {
  redirect("/transcript");
}
