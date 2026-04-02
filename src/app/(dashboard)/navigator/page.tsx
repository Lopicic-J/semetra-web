"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

/* ─── Feature Catalogue ───────────────────────────────────────────────────── */

interface Feature {
  href: string;
  emoji: string;
  label: string;
  description: string;
  keywords: string[];
  group: string;
  color: string;
  pro: boolean;
}

const FEATURES: Feature[] = [
  // ── Übersicht ──
  {
    href: "/dashboard", emoji: "🏠", label: "Dashboard", group: "Übersicht",
    description: "Deine Startseite mit Statistiken, anstehenden Prüfungen, offenen Aufgaben und Lernzeit-Übersicht.",
    keywords: ["start", "übersicht", "home", "statistik", "zusammenfassung"],
    color: "#6d28d9", pro: false,
  },
  {
    href: "/modules", emoji: "📚", label: "Module", group: "Übersicht",
    description: "Verwalte alle deine Studienmodule — Dozenten, ECTS, Zeitplan, Links und Materialien.",
    keywords: ["fach", "kurs", "vorlesung", "semester", "dozent", "ects", "modul"],
    color: "#2563eb", pro: false,
  },
  {
    href: "/tasks", emoji: "✅", label: "Aufgaben", group: "Übersicht",
    description: "To-Do-Liste mit Prioritäten, Status-Tracking, Modul-Zuordnung und Anhängen.",
    keywords: ["todo", "aufgabe", "task", "erledigen", "abgabe", "deadline", "priorität"],
    color: "#059669", pro: false,
  },
  {
    href: "/studiengaenge", emoji: "🎓", label: "FH-Voreinstellungen", group: "Übersicht",
    description: "Wähle deinen Studiengang aus vorgefertigten Schweizer FH-Programmen mit allen Modulen.",
    keywords: ["studiengang", "fh", "fachhochschule", "voreinstellung", "programm", "template"],
    color: "#7c3aed", pro: true,
  },

  // ── Planung ──
  {
    href: "/studienplan", emoji: "🎯", label: "Studienplan", group: "Planung",
    description: "Langfristige Semesterplanung mit Meilensteinen und Zielen für dein gesamtes Studium.",
    keywords: ["plan", "semester", "langzeit", "ziel", "meilenstein", "strategie"],
    color: "#dc2626", pro: false,
  },
  {
    href: "/calendar", emoji: "📅", label: "Kalender", group: "Planung",
    description: "Monats- und Wochenansicht aller Termine, Prüfungen und Abgaben auf einen Blick.",
    keywords: ["kalender", "termin", "datum", "woche", "monat", "terminplan"],
    color: "#ea580c", pro: false,
  },
  {
    href: "/timeline", emoji: "📊", label: "Timeline", group: "Planung",
    description: "Visueller Zeitstrahl deines Semesters mit allen wichtigen Meilensteinen und Deadlines.",
    keywords: ["zeitstrahl", "timeline", "gantt", "verlauf", "chronologisch"],
    color: "#0891b2", pro: false,
  },
  {
    href: "/stundenplan", emoji: "📋", label: "Stundenplan", group: "Planung",
    description: "Dein wöchentlicher Stundenplan mit Räumen, Zeiten und Modulen — automatisch aus deinen Modulen.",
    keywords: ["stundenplan", "wochenplan", "raum", "zeit", "vorlesung", "stunde"],
    color: "#4f46e5", pro: false,
  },
  {
    href: "/exams", emoji: "🎓", label: "Prüfungen", group: "Planung",
    description: "Alle Prüfungstermine verwalten — mit Typ, Gewichtung, Hilfsmitteln und Anhängen.",
    keywords: ["prüfung", "exam", "klausur", "test", "bewertung", "hilfsmittel"],
    color: "#be123c", pro: false,
  },

  // ── Wissen ──
  {
    href: "/notes", emoji: "📝", label: "Notizen", group: "Wissen",
    description: "Rich-Text-Notizen mit Checklisten, Modul-Zuordnung und Flow-Ansicht aller Notiz-Quellen.",
    keywords: ["notiz", "notizen", "schreiben", "mitschrift", "text", "checklist"],
    color: "#ca8a04", pro: false,
  },
  {
    href: "/documents", emoji: "📂", label: "Dokumente", group: "Wissen",
    description: "Zentrales Verzeichnis aller Dokumente, Links und Anhänge — nach Modul, Aufgabe und Prüfung.",
    keywords: ["dokument", "datei", "link", "anhang", "pdf", "download", "material"],
    color: "#0d9488", pro: false,
  },
  {
    href: "/knowledge", emoji: "🧠", label: "Lernziele", group: "Wissen",
    description: "Definiere Lernziele pro Modul und tracke deinen Wissensstand für gezielte Prüfungsvorbereitung.",
    keywords: ["lernziel", "wissen", "kompetenz", "fortschritt", "verstehen", "lernen"],
    color: "#db2777", pro: false,
  },
  {
    href: "/mindmaps", emoji: "🗺️", label: "Mind Maps", group: "Wissen",
    description: "Erstelle visuelle Gedankenkarten um Zusammenhänge zu erkennen und Themen zu strukturieren.",
    keywords: ["mindmap", "gedankenkarte", "struktur", "übersicht", "verbindung", "diagramm"],
    color: "#7c3aed", pro: false,
  },
  {
    href: "/brainstorming", emoji: "💡", label: "Brainstorming", group: "Wissen",
    description: "7 Kreativtechniken (SCAMPER, Pro & Contra, etc.) mit Ideen-Board, Voting und KI-Assistent.",
    keywords: ["brainstorming", "idee", "kreativ", "scamper", "kreativität", "innovation"],
    color: "#f59e0b", pro: false,
  },
  {
    href: "/flashcards", emoji: "🗃️", label: "Karteikarten", group: "Wissen",
    description: "Lernkarten erstellen und mit Spaced Repetition effektiv auswendig lernen.",
    keywords: ["karteikarte", "flashcard", "lernen", "wiederholen", "auswendig", "abfragen"],
    color: "#8b5cf6", pro: false,
  },
  {
    href: "/math", emoji: "🧮", label: "Mathe-Raum", group: "Wissen",
    description: "7 Mathe-Werkzeuge: Taschenrechner, Gleichungslöser, Matrizen, Plotter, Statistik, Einheiten, Formeln.",
    keywords: ["mathe", "rechner", "gleichung", "matrix", "statistik", "formel", "plotter", "berechnung"],
    color: "#6366f1", pro: false,
  },
  {
    href: "/timer", emoji: "⏱️", label: "Timer", group: "Wissen",
    description: "Pomodoro-Timer und Stoppuhr — tracke deine Lernzeit pro Modul mit Notizen.",
    keywords: ["timer", "pomodoro", "stoppuhr", "lernzeit", "fokus", "konzentration", "zeit"],
    color: "#16a34a", pro: false,
  },

  // ── Analyse ──
  {
    href: "/grades", emoji: "📈", label: "Noten", group: "Analyse",
    description: "Notenübersicht mit Durchschnitt, Bestanden/Nicht-Bestanden und Modul-Aufschlüsselung.",
    keywords: ["note", "noten", "durchschnitt", "bestanden", "bewertung", "ergebnis"],
    color: "#059669", pro: false,
  },
  {
    href: "/credits", emoji: "🏆", label: "Credits & ECTS", group: "Analyse",
    description: "ECTS-Fortschritt verfolgen — wie viele Credits du bereits erreicht hast und was noch fehlt.",
    keywords: ["ects", "credits", "fortschritt", "punkte", "leistungspunkte", "abschluss"],
    color: "#d97706", pro: false,
  },

  // ── System ──
  {
    href: "/settings", emoji: "⚙️", label: "Einstellungen", group: "System",
    description: "Profil, Konto, Benachrichtigungen und App-Einstellungen verwalten.",
    keywords: ["einstellung", "profil", "konto", "einstellungen", "account", "setting"],
    color: "#525252", pro: false,
  },
  {
    href: "/about", emoji: "ℹ️", label: "Über Semetra", group: "System",
    description: "Informationen zu Semetra, Version, Changelog und Kontakt.",
    keywords: ["über", "info", "version", "about", "kontakt", "hilfe"],
    color: "#525252", pro: false,
  },
];

const GROUPS = ["Übersicht", "Planung", "Wissen", "Analyse", "System"];
const GROUP_EMOJIS: Record<string, string> = {
  "Übersicht": "🏠",
  "Planung": "📅",
  "Wissen": "📖",
  "Analyse": "📊",
  "System": "⚙️",
};

/* ─── Recommendations for common student tasks ────────────────────────────── */

const QUICK_ACTIONS: { label: string; description: string; href: string; emoji: string; color: string }[] = [
  { label: "Prüfung vorbereiten", description: "Lernziele checken, Karteikarten lernen, Notizen durchgehen", href: "/knowledge", emoji: "📖", color: "#7c3aed" },
  { label: "Aufgabe erledigen", description: "Offene Tasks ansehen und abhaken", href: "/tasks", emoji: "✏️", color: "#059669" },
  { label: "Lernzeit starten", description: "Timer starten und fokussiert lernen", href: "/timer", emoji: "⏱️", color: "#16a34a" },
  { label: "Mathe lösen", description: "Gleichungen, Matrizen oder Funktionen berechnen", href: "/math", emoji: "🧮", color: "#6366f1" },
  { label: "Ideen sammeln", description: "Brainstorming-Session mit Kreativtechniken starten", href: "/brainstorming", emoji: "💡", color: "#f59e0b" },
  { label: "Notizen schreiben", description: "Neue Notiz erstellen oder bestehende finden", href: "/notes", emoji: "📝", color: "#ca8a04" },
];

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function NavigatorPage() {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = FEATURES;
    if (activeGroup) items = items.filter((f) => f.group === activeGroup);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((f) =>
        f.label.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.keywords.some((k) => k.includes(q)) ||
        f.group.toLowerCase().includes(q)
      );
    }
    return items;
  }, [search, activeGroup]);

  const grouped = useMemo(() => {
    const map: Record<string, Feature[]> = {};
    filtered.forEach((f) => {
      if (!map[f.group]) map[f.group] = [];
      map[f.group].push(f);
    });
    return map;
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">🧭 Navigator</h1>
        <p className="text-zinc-400 text-sm mt-1">Finde schnell die richtige Funktion für dein Anliegen</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Was möchtest du tun? z.B. &quot;Prüfung&quot;, &quot;Notizen&quot;, &quot;Mathe&quot;..."
          className="w-full bg-zinc-900 text-white rounded-xl px-5 py-4 pl-12 border border-zinc-800 text-base focus:outline-none focus:border-violet-600 transition-colors"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">✕</button>
        )}
      </div>

      {/* Quick Actions */}
      {!search && !activeGroup && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Schnellaktionen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((qa) => (
              <Link key={qa.href} href={qa.href} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-violet-600 hover:bg-zinc-800 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: qa.color + "20" }}>{qa.emoji}</div>
                  <span className="text-white font-medium text-sm group-hover:text-violet-300 transition-colors">{qa.label}</span>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">{qa.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Group Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveGroup(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${!activeGroup ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
        >
          Alle ({FEATURES.length})
        </button>
        {GROUPS.map((g) => {
          const count = FEATURES.filter((f) => f.group === g).length;
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(activeGroup === g ? null : g)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${activeGroup === g ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              <span>{GROUP_EMOJIS[g]}</span>
              <span>{g}</span>
              <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Features by Group */}
      {GROUPS.filter((g) => grouped[g]?.length).map((g) => (
        <div key={g}>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>{GROUP_EMOJIS[g]}</span> {g}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[g].map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-violet-600 hover:bg-zinc-800 transition-all group relative overflow-hidden"
              >
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: f.color }} />

                <div className="flex items-start gap-3 pl-2">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 mt-0.5" style={{ backgroundColor: f.color + "18" }}>
                    {f.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm group-hover:text-violet-300 transition-colors">{f.label}</span>
                      {f.pro && <span className="text-xs bg-violet-900 text-violet-300 px-1.5 py-0.5 rounded font-medium">PRO</span>}
                    </div>
                    <p className="text-zinc-500 text-xs mt-1 leading-relaxed line-clamp-2">{f.description}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500">{f.group}</span>
                    </div>
                  </div>
                  <span className="text-zinc-700 group-hover:text-violet-400 transition-colors ml-auto shrink-0 mt-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-zinc-400 text-sm">Keine Funktionen gefunden für &quot;{search}&quot;</p>
          <button onClick={() => { setSearch(""); setActiveGroup(null); }} className="mt-3 text-violet-400 text-sm hover:text-violet-300">Filter zurücksetzen</button>
        </div>
      )}

      {/* Stats footer */}
      {!search && !activeGroup && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex items-center justify-between text-sm">
          <span className="text-zinc-500">{FEATURES.length} Funktionen in {GROUPS.length} Kategorien verfügbar</span>
          <span className="text-zinc-600">Semetra — Dein Studienbegleiter</span>
        </div>
      )}
    </div>
  );
}
