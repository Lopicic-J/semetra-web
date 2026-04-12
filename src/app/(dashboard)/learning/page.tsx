import { redirect } from "next/navigation";

// Learning hub aufgelöst — Lernplan, Timer, Flashcards etc. sind eigenständige Seiten.
// SiblingTabs (aus Layout) zeigt: Lernplan | Lernziele | Timer | Karteikarten | Mathe
export default function LearningRedirect() {
  redirect("/lernplan");
}
