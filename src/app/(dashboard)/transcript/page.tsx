import { redirect } from "next/navigation";

// Consolidated into /studium hub — redirect to transcript tab
export default function TranscriptPage() {
  redirect("/studium?tab=transcript");
}
