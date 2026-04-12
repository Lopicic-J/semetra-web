import { redirect } from "next/navigation";

// Creative hub aufgelöst — Mindmaps und Brainstorming sind eigenständige Seiten.
// SiblingTabs (aus Layout) zeigt: KI-Assistent | Mindmaps | Brainstorming
export default function CreativeRedirect() {
  redirect("/mindmaps");
}
