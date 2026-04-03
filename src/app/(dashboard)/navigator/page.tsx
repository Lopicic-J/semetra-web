"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

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

function getFeatures(t: (key: string, vars?: Record<string, string | number>) => string): Feature[] {
  return [
    // ── Übersicht ──
    {
      href: "/dashboard", emoji: "🏠", label: t("nav.dashboard"), group: t("navigator.overviewSection"),
      description: t("navigator.dashboardDesc"),
      keywords: ["start", "übersicht", "home", "statistik", "zusammenfassung"],
      color: "#6d28d9", pro: false,
    },
    {
      href: "/modules", emoji: "📚", label: t("nav.modules"), group: t("navigator.overviewSection"),
      description: t("navigator.modulesDesc"),
      keywords: ["fach", "kurs", "vorlesung", "semester", "dozent", "ects", "modul"],
      color: "#2563eb", pro: false,
    },
    {
      href: "/tasks", emoji: "✅", label: t("nav.tasks"), group: t("navigator.overviewSection"),
      description: t("navigator.tasksDesc"),
      keywords: ["todo", "aufgabe", "task", "erledigen", "abgabe", "deadline", "priorität"],
      color: "#059669", pro: false,
    },
    {
      href: "/studiengaenge", emoji: "🎓", label: t("studiengaenge.title"), group: t("navigator.overviewSection"),
      description: t("navigator.fhSettingsDesc"),
      keywords: ["studiengang", "fh", "fachhochschule", "voreinstellung", "programm", "template"],
      color: "#7c3aed", pro: true,
    },

    // ── Planung ──
    {
      href: "/studienplan", emoji: "🎯", label: t("nav.studienplan"), group: t("navigator.planningSection"),
      description: t("navigator.studienplanDesc"),
      keywords: ["plan", "semester", "langzeit", "ziel", "meilenstein", "strategie"],
      color: "#dc2626", pro: false,
    },
    {
      href: "/calendar", emoji: "📅", label: t("nav.calendar"), group: t("navigator.planningSection"),
      description: t("navigator.calendarDesc"),
      keywords: ["kalender", "termin", "datum", "woche", "monat", "terminplan"],
      color: "#ea580c", pro: false,
    },
    {
      href: "/timeline", emoji: "📊", label: t("nav.timeline"), group: t("navigator.planningSection"),
      description: t("navigator.timelineDesc"),
      keywords: ["zeitstrahl", "timeline", "gantt", "verlauf", "chronologisch"],
      color: "#0891b2", pro: false,
    },
    {
      href: "/stundenplan", emoji: "📋", label: t("nav.stundenplan"), group: t("navigator.planningSection"),
      description: t("navigator.stundenplanDesc"),
      keywords: ["stundenplan", "wochenplan", "raum", "zeit", "vorlesung", "stunde"],
      color: "#4f46e5", pro: false,
    },
    {
      href: "/exams", emoji: "🎓", label: t("nav.exams"), group: t("navigator.planningSection"),
      description: t("navigator.examsDesc"),
      keywords: ["prüfung", "exam", "klausur", "test", "bewertung", "hilfsmittel"],
      color: "#be123c", pro: false,
    },

    // ── Wissen ──
    {
      href: "/notes", emoji: "📝", label: t("nav.notes"), group: t("navigator.knowledgeSection"),
      description: t("navigator.notesDesc"),
      keywords: ["notiz", "notizen", "schreiben", "mitschrift", "text", "checklist"],
      color: "#ca8a04", pro: false,
    },
    {
      href: "/documents", emoji: "📂", label: t("nav.documents"), group: t("navigator.knowledgeSection"),
      description: t("navigator.documentsDesc"),
      keywords: ["dokument", "datei", "link", "anhang", "pdf", "download", "material"],
      color: "#0d9488", pro: false,
    },
    {
      href: "/knowledge", emoji: "🧠", label: t("nav.knowledge"), group: t("navigator.knowledgeSection"),
      description: t("navigator.knowledgeDesc"),
      keywords: ["lernziel", "wissen", "kompetenz", "fortschritt", "verstehen", "lernen"],
      color: "#db2777", pro: false,
    },
    {
      href: "/mindmaps", emoji: "🗺️", label: t("nav.mindmaps"), group: t("navigator.knowledgeSection"),
      description: t("navigator.mindmapsDesc"),
      keywords: ["mindmap", "gedankenkarte", "struktur", "übersicht", "verbindung", "diagramm"],
      color: "#7c3aed", pro: false,
    },
    {
      href: "/brainstorming", emoji: "💡", label: t("nav.brainstorming"), group: t("navigator.knowledgeSection"),
      description: t("navigator.brainstormingDesc"),
      keywords: ["brainstorming", "idee", "kreativ", "scamper", "kreativität", "innovation"],
      color: "#f59e0b", pro: false,
    },
    {
      href: "/flashcards", emoji: "🗃️", label: t("nav.flashcards"), group: t("navigator.knowledgeSection"),
      description: t("navigator.flashcardsDesc"),
      keywords: ["karteikarte", "flashcard", "lernen", "wiederholen", "auswendig", "abfragen"],
      color: "#8b5cf6", pro: false,
    },
    {
      href: "/math", emoji: "🧮", label: t("nav.math"), group: t("navigator.knowledgeSection"),
      description: t("navigator.mathDesc"),
      keywords: ["mathe", "rechner", "gleichung", "matrix", "statistik", "formel", "plotter", "berechnung"],
      color: "#6366f1", pro: false,
    },
    {
      href: "/timer", emoji: "⏱️", label: t("nav.timer"), group: t("navigator.knowledgeSection"),
      description: t("navigator.timerDesc"),
      keywords: ["timer", "pomodoro", "stoppuhr", "lernzeit", "fokus", "konzentration", "zeit"],
      color: "#16a34a", pro: false,
    },

    // ── Analyse ──
    {
      href: "/grades", emoji: "📈", label: t("nav.grades"), group: t("navigator.analyticsSection"),
      description: t("navigator.gradesDesc"),
      keywords: ["note", "noten", "durchschnitt", "bestanden", "bewertung", "ergebnis"],
      color: "#059669", pro: false,
    },
    {
      href: "/credits", emoji: "🏆", label: t("nav.credits"), group: t("navigator.analyticsSection"),
      description: t("navigator.creditsDesc"),
      keywords: ["ects", "credits", "fortschritt", "punkte", "leistungspunkte", "abschluss"],
      color: "#d97706", pro: false,
    },

    // ── System ──
    {
      href: "/settings", emoji: "⚙️", label: t("nav.settings"), group: t("navigator.systemSection"),
      description: t("navigator.settingsDesc"),
      keywords: ["einstellung", "profil", "konto", "einstellungen", "account", "setting"],
      color: "#525252", pro: false,
    },
    {
      href: "/about", emoji: "ℹ️", label: t("nav.about"), group: t("navigator.systemSection"),
      description: t("navigator.aboutDesc"),
      keywords: ["über", "info", "version", "about", "kontakt", "hilfe"],
      color: "#525252", pro: false,
    },
  ];
}

function getGroupKeys(t: (key: string, vars?: Record<string, string | number>) => string): string[] {
  return [
    t("navigator.overviewSection"),
    t("navigator.planningSection"),
    t("navigator.knowledgeSection"),
    t("navigator.analyticsSection"),
    t("navigator.systemSection"),
  ];
}

function getGroupEmojis(t: (key: string, vars?: Record<string, string | number>) => string): Record<string, string> {
  return {
    [t("navigator.overviewSection")]: "🏠",
    [t("navigator.planningSection")]: "📅",
    [t("navigator.knowledgeSection")]: "📖",
    [t("navigator.analyticsSection")]: "📊",
    [t("navigator.systemSection")]: "⚙️",
  };
}

/* ─── Recommendations for common student tasks ────────────────────────────── */

function getQuickActions(t: (key: string, vars?: Record<string, string | number>) => string): { label: string; description: string; href: string; emoji: string; color: string }[] {
  return [
    { label: t("navigator.prepareExam"), description: "Lernziele checken, Karteikarten lernen, Notizen durchgehen", href: "/knowledge", emoji: "📖", color: "#7c3aed" },
    { label: t("navigator.completeTask"), description: "Offene Tasks ansehen und abhaken", href: "/tasks", emoji: "✏️", color: "#059669" },
    { label: t("navigator.startLearning"), description: "Timer starten und fokussiert lernen", href: "/timer", emoji: "⏱️", color: "#16a34a" },
    { label: t("navigator.solveMath"), description: "Gleichungen, Matrizen oder Funktionen berechnen", href: "/math", emoji: "🧮", color: "#6366f1" },
    { label: t("navigator.brainstormIdeas"), description: "Brainstorming-Session mit Kreativtechniken starten", href: "/brainstorming", emoji: "💡", color: "#f59e0b" },
    { label: t("navigator.writeNotes"), description: "Neue Notiz erstellen oder bestehende finden", href: "/notes", emoji: "📝", color: "#ca8a04" },
  ];
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function NavigatorPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const FEATURES = useMemo(() => getFeatures(t), [t]);
  const GROUPS = useMemo(() => getGroupKeys(t), [t]);
  const GROUP_EMOJIS = useMemo(() => getGroupEmojis(t), [t]);
  const QUICK_ACTIONS = useMemo(() => getQuickActions(t), [t]);

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
  }, [search, activeGroup, FEATURES]);

  const grouped = useMemo(() => {
    const map: Record<string, Feature[]> = {};
    filtered.forEach((f) => {
      if (!map[f.group]) map[f.group] = [];
      map[f.group].push(f);
    });
    return map;
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">🧭 {t("navigator.title")}</h1>
        <p className="text-surface-500 text-xs sm:text-sm mt-1">{t("navigator.subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("navigator.searchPlaceholder")}
          className="w-full bg-white text-surface-900 rounded-xl px-5 py-4 pl-12 border border-surface-200 text-base focus:outline-none focus:border-brand-600 transition-colors"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-900">✕</button>
        )}
      </div>

      {/* Quick Actions */}
      {!search && !activeGroup && (
        <div>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">{t("navigator.quickActions")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {QUICK_ACTIONS.map((qa) => (
              <Link key={qa.href} href={qa.href} className="bg-white rounded-xl border border-surface-200 p-4 hover:border-brand-600 hover:bg-surface-100 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: qa.color + "20" }}>{qa.emoji}</div>
                  <span className="text-surface-900 font-medium text-sm group-hover:text-brand-600 transition-colors">{qa.label}</span>
                </div>
                <p className="text-surface-400 text-xs leading-relaxed">{qa.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Group Filter */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setActiveGroup(null)}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${!activeGroup ? "bg-brand-600 text-white" : "bg-surface-200 text-surface-500 hover:bg-surface-300"}`}
        >
          {t("navigator.all")} ({FEATURES.length})
        </button>
        {GROUPS.map((g) => {
          const count = FEATURES.filter((f) => f.group === g).length;
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(activeGroup === g ? null : g)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 ${activeGroup === g ? "bg-brand-600 text-white" : "bg-surface-200 text-surface-500 hover:bg-surface-300"}`}
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
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>{GROUP_EMOJIS[g]}</span> {g}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[g].map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="bg-white rounded-xl border border-surface-200 p-4 hover:border-brand-600 hover:bg-surface-100 transition-all group relative overflow-hidden"
              >
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: f.color }} />

                <div className="flex items-start gap-3 pl-2">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 mt-0.5" style={{ backgroundColor: f.color + "18" }}>
                    {f.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-surface-900 font-semibold text-sm group-hover:text-brand-600 transition-colors">{f.label}</span>
                      {f.pro && <span className="text-xs bg-brand-900 text-brand-300 px-1.5 py-0.5 rounded font-medium">PRO</span>}
                    </div>
                    <p className="text-surface-400 text-xs mt-1 leading-relaxed line-clamp-2">{f.description}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-200 text-surface-400">{f.group}</span>
                    </div>
                  </div>
                  <span className="text-surface-300 group-hover:text-brand-600 transition-colors ml-auto shrink-0 mt-1">→</span>
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
          <p className="text-surface-500 text-sm">{t("navigator.noResults", { query: search })}</p>
          <button onClick={() => { setSearch(""); setActiveGroup(null); }} className="mt-3 text-brand-600 text-sm hover:text-brand-700">{t("navigator.resetFilters")}</button>
        </div>
      )}

      {/* Stats footer */}
      {!search && !activeGroup && (
        <div className="bg-white rounded-xl border border-surface-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm gap-1">
          <span className="text-surface-400">{t("navigator.stats", { features: FEATURES.length, categories: GROUPS.length })}</span>
          <span className="text-surface-300">{t("navigator.footer")}</span>
        </div>
      )}
    </div>
  );
}
