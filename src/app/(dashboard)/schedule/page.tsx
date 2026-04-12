import { redirect } from "next/navigation";

// Schedule hub aufgelöst — Kalender, Stundenplan, Smart Schedule sind eigenständige Seiten.
// SiblingTabs (aus Layout) zeigt: Kalender | Stundenplan | Smart Schedule
export default function ScheduleRedirect() {
  redirect("/calendar");
}
