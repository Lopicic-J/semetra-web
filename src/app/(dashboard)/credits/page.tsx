import { redirect } from "next/navigation";

// Consolidated into /studium hub — credits data is part of the overview tab
export default function CreditsPage() {
  redirect("/overview");
}
