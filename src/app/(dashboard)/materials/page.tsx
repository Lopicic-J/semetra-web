import { redirect } from "next/navigation";

// Materials hub aufgelöst — Notizen und Dokumente sind eigenständige Seiten.
// SiblingTabs (aus Layout) zeigt: Notizen | Dokumente
export default function MaterialsRedirect() {
  redirect("/notes");
}
