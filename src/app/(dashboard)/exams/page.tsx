"use client";

import ExamsContent from "./ExamsContent";

// Standalone — Prüfungsmanager zeigt direkt Prüfungen.
// Exam Intelligence existiert als eigener Tab innerhalb ExamsContent.
// SiblingTabs (aus Layout) zeigt: Prüfungen | Noten
export default function ExamsPage() {
  return <ExamsContent />;
}
