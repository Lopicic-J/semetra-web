"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useStreaks } from "@/lib/hooks/useStreaks";
import {
  Search, LayoutDashboard, BookOpen, CheckSquare, GraduationCap,
  Target, Calendar, Clock, LayoutGrid, Award, FileText, FolderOpen,
  Brain, Network, Lightbulb, Layers, Calculator, Timer, BarChart3,
  Trophy, Settings, Info, Flame, ArrowRight, Zap, Sparkles, TrendingUp,
  AlertTriangle, Command, X, type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   FEATURE DEFINITIONS — Lucide icons, grouped by workflow
   ═══════════════════════════════════════════════════════════════════════ */

interface Feature {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  keywords: string[];
  group: string;
  color: string;
  pro: boolean;
}

interface QuickStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  href: string;
  urgent?: boolean;
}

function getFeatures(t: (k: string) => string): Feature[] {
  return [
    // Übersicht
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", group: "overview",
      description: "Dein persönlicher Startbildschirm mit den wichtigsten Infos auf einen Blick.", keywords: ["start", "übersicht", "home", "statistik"], color: "#6d28d9", pro: false },
    { href: "/modules", icon: BookOpen, label: "Module", group: "overview",
      description: "Verwalte deine Studienmodule, ECTS, Noten und Prüfungstermine.", keywords: ["fach", "kurs", "vorlesung", "modul", "ects"], color: "#2563eb", pro: false },
    { href: "/tasks", icon: CheckSquare, label: "Aufgaben", group: "overview",
      description: "Erstelle und verwalte To-Dos mit Deadlines und Prioritäten.", keywords: ["todo", "aufgabe", "erledigen", "deadline", "task"], color: "#059669", pro: false },

    // Planung
    { href: "/schedule?tab=smart", icon: Zap, label: "Smart Schedule", group: "planning",
      description: "KI-optimierter Lernplan, der sich an deinen Rhythmus anpasst.", keywords: ["smart", "schedule", "automatisch", "plan", "ki"], color: "#7c3aed", pro: false },
    { href: "/schedule?tab=stundenplan", icon: LayoutGrid, label: "Stundenplan", group: "planning",
      description: "Dein Wochenstundenplan mit Vorlesungen und Lernblöcken.", keywords: ["stundenplan", "wochenplan", "raum", "vorlesung"], color: "#4f46e5", pro: false },
    { href: "/schedule?tab=calendar", icon: Calendar, label: "Kalender", group: "planning",
      description: "Alle Termine, Prüfungen und Deadlines im Überblick.", keywords: ["kalender", "termin", "datum", "woche"], color: "#ea580c", pro: false },
    { href: "/exams", icon: Award, label: "Prüfungen", group: "planning",
      description: "Prüfungstermine verwalten, Vorbereitung planen und Fortschritt tracken.", keywords: ["prüfung", "exam", "klausur", "test"], color: "#be123c", pro: false },
    { href: "/exams?tab=intelligence", icon: AlertTriangle, label: "Prüfungs-Intelligence", group: "planning",
      description: "Risikoanalyse und Prognosen für deine bevorstehenden Prüfungen.", keywords: ["risiko", "prognose", "vorbereitung", "intelligence"], color: "#dc2626", pro: true },

    // Lernen
    { href: "/learning?tab=timer", icon: Timer, label: "Lernzeit & Timer", group: "learning",
      description: "Pomodoro, Deep Work oder freie Sessions — tracke deine Lernzeit.", keywords: ["timer", "pomodoro", "stoppuhr", "lernzeit", "streak"], color: "#16a34a", pro: false },
    { href: "/learning?tab=materials", icon: FileText, label: "Materialien", group: "learning",
      description: "Notizen und Dokumente an einem Ort — schreiben, hochladen, organisieren.", keywords: ["notiz", "dokument", "datei", "pdf", "material", "mitschrift"], color: "#ca8a04", pro: false },
    { href: "/learning?tab=groups", icon: Brain, label: "Lerngruppen", group: "learning",
      description: "Erstelle Gruppen, chatte mit Kommilitonen und teile Module & Dokumente.", keywords: ["gruppe", "lerngruppe", "chat", "teilen", "kommilitone"], color: "#2563eb", pro: false },
    { href: "/learning?tab=flashcards", icon: Layers, label: "Karteikarten", group: "learning",
      description: "Erstelle Karteikarten und lerne mit Spaced Repetition.", keywords: ["karteikarte", "flashcard", "wiederholen", "lernen"], color: "#8b5cf6", pro: false },
    { href: "/learning?tab=knowledge", icon: Brain, label: "Lernziele", group: "learning",
      description: "Definiere und tracke Lernziele pro Modul und Thema.", keywords: ["lernziel", "wissen", "kompetenz", "fortschritt"], color: "#db2777", pro: false },

    // Werkzeuge
    { href: "/werkzeuge?tab=ki", icon: Sparkles, label: "KI-Assistent", group: "tools",
      description: "Frag die KI was du nicht verstehst — kennt deine Module und passt sich an.", keywords: ["ki", "ai", "chatbot", "frage", "erklärung", "assistent"], color: "#6d28d9", pro: false },
    { href: "/werkzeuge?tab=mindmaps", icon: Network, label: "Mind Maps", group: "tools",
      description: "Gedanken strukturieren, Themen visualisieren, im Vollbild arbeiten.", keywords: ["mindmap", "gedankenkarte", "struktur", "visuell"], color: "#7c3aed", pro: false },
    { href: "/werkzeuge?tab=brainstorming", icon: Lightbulb, label: "Brainstorming", group: "tools",
      description: "Ideen sammeln mit SCAMPER, Pro/Con, Starbursting und mehr.", keywords: ["brainstorming", "idee", "kreativ", "scamper"], color: "#f59e0b", pro: false },
    { href: "/werkzeuge?tab=mathe", icon: Calculator, label: "Mathe-Raum", group: "tools",
      description: "Gleichungen lösen, Formeln speichern, Schritt-für-Schritt-Lösungen.", keywords: ["mathe", "rechner", "gleichung", "formel", "math"], color: "#6366f1", pro: false },

    // Analyse & Fortschritt
    { href: "/studium?tab=uebersicht", icon: Trophy, label: "Studienfortschritt", group: "analytics",
      description: "ECTS, Credits und akademischer Gesamtfortschritt auf einen Blick.", keywords: ["ects", "credits", "fortschritt", "übersicht"], color: "#d97706", pro: false },
    { href: "/studium?tab=noten", icon: BarChart3, label: "Noten & Durchschnitt", group: "analytics",
      description: "Alle Noten, Durchschnitt, Bestanden/Nicht-Bestanden Analyse.", keywords: ["note", "durchschnitt", "bestanden", "gpa"], color: "#059669", pro: false },
    { href: "/studium?tab=studienplan", icon: Target, label: "Studienplan", group: "analytics",
      description: "Langzeit-Studienplanung über alle Semester hinweg.", keywords: ["plan", "semester", "langzeit", "ziel", "studienplan"], color: "#dc2626", pro: false },
    { href: "/fortschritt?tab=dna", icon: Flame, label: "Lern-DNA", group: "analytics",
      description: "Dein persönliches Lernprofil — Stärken, Muster und Optimierungspotenzial.", keywords: ["dna", "profil", "muster", "stärken", "analyse"], color: "#f97316", pro: true },
    { href: "/fortschritt?tab=insights", icon: TrendingUp, label: "Weekly Review", group: "analytics",
      description: "Wöchentlicher Rückblick auf deine Lernzeit und Fortschritte.", keywords: ["woche", "review", "rückblick", "insights"], color: "#0891b2", pro: false },
    { href: "/fortschritt?tab=erfolge", icon: Award, label: "Erfolge", group: "analytics",
      description: "Achievements und Meilensteine auf deinem Lernweg.", keywords: ["erfolg", "achievement", "badge", "meilenstein"], color: "#eab308", pro: false },

    // System & Konto
    { href: "/upgrade", icon: Zap, label: "Pro & Preise", group: "system",
      description: "Pro Basic, Pro Full oder Lifetime — alle Pläne und Preise.", keywords: ["pro", "upgrade", "preis", "abo", "premium", "bezahlen"], color: "#7c3aed", pro: false },
    { href: "/profile", icon: Settings, label: "Profil", group: "system",
      description: "Dein Profil, Institution und persönliche Einstellungen.", keywords: ["profil", "konto", "account", "bild"], color: "#525252", pro: false },
    { href: "/settings", icon: Settings, label: "Einstellungen", group: "system",
      description: "App-Einstellungen, Sprache, Theme und Benachrichtigungen.", keywords: ["einstellung", "theme", "dark", "sprache", "benachrichtigung"], color: "#525252", pro: false },
  ];
}

const GROUP_CONFIG: Record<string, { labelKey: string; icon: LucideIcon; fallback: string }> = {
  overview: { labelKey: "navigator.overviewSection", icon: LayoutDashboard, fallback: "Übersicht" },
  planning: { labelKey: "navigator.planningSection", icon: Calendar, fallback: "Planung & Termine" },
  learning: { labelKey: "navigator.knowledgeSection", icon: Brain, fallback: "Lernen & Materialien" },
  tools: { labelKey: "navigator.toolsSection", icon: Sparkles, fallback: "Werkzeuge" },
  analytics: { labelKey: "navigator.analyticsSection", icon: BarChart3, fallback: "Fortschritt & Analyse" },
  system: { labelKey: "navigator.systemSection", icon: Settings, fallback: "Konto & Einstellungen" },
};

const GROUP_ORDER = ["overview", "planning", "learning", "tools", "analytics", "system"];

/* ═══════════════════════════════════════════════════════════════════════
   NAVIGATOR PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function NavigatorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const streak = useStreaks();
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Live data
  const [dueTasks, setDueTasks] = useState(0);
  const [upcomingExams, setUpcomingExams] = useState(0);
  const [dueFlashcards, setDueFlashcards] = useState(0);
  const [nextExamDays, setNextExamDays] = useState<number | null>(null);
  const [nextExamTitle, setNextExamTitle] = useState("");

  const fetchLiveData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Due tasks (not done)
    const { count: taskCount } = await supabase
      .from("tasks").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).neq("status", "done");
    setDueTasks(taskCount ?? 0);

    // Upcoming exams (next 90 days)
    const now = new Date();
    const in90 = new Date(); in90.setDate(in90.getDate() + 90);
    const { data: exams } = await supabase
      .from("events").select("start_dt, title")
      .eq("event_type", "exam")
      .gte("start_dt", now.toISOString()).lte("start_dt", in90.toISOString())
      .order("start_dt");
    setUpcomingExams(exams?.length ?? 0);
    if (exams && exams.length > 0) {
      const nearest = exams[0];
      const daysUntil = Math.ceil((new Date(nearest.start_dt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setNextExamDays(daysUntil);
      setNextExamTitle(nearest.title);
    }

    // Due flashcards
    const { count: fcCount } = await supabase
      .from("flashcards").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).or(`next_review.is.null,next_review.lte.${now.toISOString()}`);
    setDueFlashcards(fcCount ?? 0);
  }, [supabase]);

  useEffect(() => { fetchLiveData(); }, [fetchLiveData]);

  const FEATURES = useMemo(() => getFeatures(t), [t]);

  // Filtered results
  const filtered = useMemo(() => {
    let items = FEATURES;
    if (activeGroup) items = items.filter(f => f.group === activeGroup);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(f =>
        f.label.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.keywords.some(k => k.includes(q))
      );
    }
    return items;
  }, [search, activeGroup, FEATURES]);

  const grouped = useMemo(() => {
    const map: Record<string, Feature[]> = {};
    filtered.forEach(f => {
      if (!map[f.group]) map[f.group] = [];
      map[f.group].push(f);
    });
    return map;
  }, [filtered]);

  // Quick stats
  const quickStats: QuickStat[] = useMemo(() => [
    {
      label: t("navigator.openTasks") || "Offene Aufgaben",
      value: dueTasks, icon: CheckSquare, color: "#059669", href: "/tasks",
      urgent: dueTasks > 5,
    },
    {
      label: t("navigator.dueCards") || "Fällige Karten",
      value: dueFlashcards, icon: Layers, color: "#8b5cf6", href: "/flashcards",
      urgent: dueFlashcards > 20,
    },
    {
      label: nextExamTitle ? nextExamTitle : (t("navigator.nextExam") || "Nächste Prüfung"),
      value: nextExamDays != null ? (nextExamDays === 0 ? "Heute!" : nextExamDays === 1 ? "Morgen" : `in ${nextExamDays} Tagen`) : "Keine",
      icon: Award, color: "#be123c", href: "/exams",
      urgent: nextExamDays != null && nextExamDays <= 7,
    },
    {
      label: t("navigator.studyStreak") || "Lernsträhne",
      value: `${streak.currentStreak}d`,
      icon: Flame, color: "#ea580c", href: "/dashboard",
    },
  ], [dueTasks, dueFlashcards, nextExamDays, streak.currentStreak, t]);

  // Keyboard shortcut: focus search with Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("nav-search")?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        (document.activeElement as HTMLElement)?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Navigate on Enter when single result
  useEffect(() => {
    if (filtered.length === 1 && search.length > 1) {
      const onEnter = (e: KeyboardEvent) => {
        if (e.key === "Enter") router.push(filtered[0].href);
      };
      window.addEventListener("keydown", onEnter);
      return () => window.removeEventListener("keydown", onEnter);
    }
  }, [filtered, search, router]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-3 sm:p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <Zap size={18} className="text-brand-600 dark:text-brand-400" />
            </div>
            {t("navigator.title") || "Navigator"}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-xs sm:text-sm mt-1">{t("navigator.subtitle") || "Dein Studien-Kommandozentrale"}</p>
        </div>
      </div>

      {/* ── Search Bar (Cmd+K style) ── */}
      <div className="relative group">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 group-focus-within:text-brand-500 transition" />
        <input
          id="nav-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("navigator.searchPlaceholder") || "Suche nach Funktionen, Tools, Seiten..."}
          className="w-full bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-2xl px-12 py-3.5 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/50 transition-all shadow-sm"
        />
        {search ? (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-300 dark:text-surface-600 hover:text-surface-600 dark:hover:text-surface-400 transition">
            <X size={16} />
          </button>
        ) : (
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-surface-300 dark:text-surface-600 border border-surface-200 dark:border-surface-700 rounded px-1.5 py-0.5 font-mono hidden sm:inline bg-surface-50 dark:bg-surface-900">
            <Command size={10} className="inline mr-0.5" />K
          </kbd>
        )}
      </div>

      {/* ── Quick Stats ── */}
      {!search && !activeGroup && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickStats.map(stat => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className={`bg-surface-100 dark:bg-surface-800 rounded-xl border p-3 sm:p-3.5 hover:shadow-md transition-all group ${
                  stat.urgent ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20" : "border-surface-200 dark:border-surface-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "15" }}>
                    <Icon size={14} style={{ color: stat.color }} />
                  </div>
                  {stat.urgent && <AlertTriangle size={12} className="text-red-500 dark:text-red-400" />}
                </div>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{stat.value}</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">{stat.label}</p>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Quick Actions (context-aware) ── */}
      {!search && !activeGroup && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dueFlashcards > 0 && (
            <Link href="/flashcards" className="flex items-center gap-3 bg-gradient-to-r from-violet-50 dark:from-violet-900/20 to-purple-50 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                <Layers size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-900 dark:text-violet-300 group-hover:text-violet-700 dark:group-hover:text-violet-200">{dueFlashcards} {t("navigator.cardsDueAction") || "Karten wiederholen"}</p>
                <p className="text-[11px] text-violet-600 dark:text-violet-400">{t("navigator.cardsDueHint") || "Spaced Repetition — jetzt fällig"}</p>
              </div>
              <ArrowRight size={16} className="text-violet-300 dark:text-violet-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition ml-auto shrink-0" />
            </Link>
          )}
          {dueTasks > 0 && (
            <Link href="/tasks" className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 dark:from-emerald-900/20 to-green-50 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-200">{dueTasks} {t("navigator.tasksOpenAction") || "Tasks offen"}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{t("navigator.tasksOpenHint") || "Aufgaben anschauen und abhaken"}</p>
              </div>
              <ArrowRight size={16} className="text-emerald-300 dark:text-emerald-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition ml-auto shrink-0" />
            </Link>
          )}
          <Link href="/timer" className="flex items-center gap-3 bg-gradient-to-r from-amber-50 dark:from-amber-900/20 to-orange-50 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Timer size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 group-hover:text-amber-700 dark:group-hover:text-amber-200">{t("navigator.startLearning") || "Lernzeit starten"}</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("navigator.startLearningHint") || "Timer starten und fokussiert lernen"}</p>
            </div>
            <ArrowRight size={16} className="text-amber-300 dark:text-amber-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition ml-auto shrink-0" />
          </Link>
        </div>
      )}

      {/* ── Group Filter Chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setActiveGroup(null)}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            !activeGroup ? "bg-brand-600 dark:bg-brand-700 text-white shadow-sm" : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-400"
          }`}
        >
          {t("navigator.all") || "Alle"} ({FEATURES.length})
        </button>
        {GROUP_ORDER.map(gKey => {
          const cfg = GROUP_CONFIG[gKey];
          const Icon = cfg.icon;
          const count = FEATURES.filter(f => f.group === gKey).length;
          const active = activeGroup === gKey;
          return (
            <button
              key={gKey}
              onClick={() => setActiveGroup(active ? null : gKey)}
              className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                active ? "bg-brand-600 dark:bg-brand-700 text-white shadow-sm" : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-400"
              }`}
            >
              <Icon size={13} />
              <span>{t(cfg.labelKey) || cfg.fallback}</span>
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Feature Grid by Group ── */}
      {GROUP_ORDER.filter(gKey => grouped[gKey]?.length).map(gKey => {
        const cfg = GROUP_CONFIG[gKey];
        const Icon = cfg.icon;
        return (
          <div key={gKey}>
            <h2 className="text-xs font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Icon size={13} /> {t(cfg.labelKey) || cfg.fallback}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {grouped[gKey].map(f => {
                const FIcon = f.icon;
                return (
                  <Link
                    key={f.href}
                    href={f.href}
                    className="bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 sm:p-3.5 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: f.color + "12" }}>
                        <FIcon size={18} style={{ color: f.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{f.label}</span>
                          {f.pro && (
                            <span className="text-[9px] bg-brand-900 dark:bg-brand-900 text-brand-300 dark:text-brand-300 px-1.5 py-0.5 rounded font-bold">PRO</span>
                          )}
                        </div>
                        <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 leading-relaxed line-clamp-2">{f.description}</p>
                      </div>
                      <ArrowRight size={14} className="text-surface-200 dark:text-surface-700 group-hover:text-brand-400 dark:group-hover:text-brand-400 transition shrink-0 mt-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Search: single result highlight ── */}
      {search && filtered.length === 1 && (
        <p className="text-center text-xs text-surface-400">
          <kbd className="text-[10px] border border-surface-200 rounded px-1.5 py-0.5 font-mono mr-1">Enter</kbd>
          {t("navigator.pressEnter") || "drücken um direkt zu öffnen"}
        </p>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search size={40} className="mx-auto mb-3 text-surface-200 dark:text-surface-700" />
          <p className="text-surface-500 dark:text-surface-400 text-sm">{t("navigator.noResults") || `Keine Ergebnisse für "${search}"`}</p>
          <button
            onClick={() => { setSearch(""); setActiveGroup(null); }}
            className="mt-3 text-brand-600 dark:text-brand-400 text-sm hover:text-brand-700 dark:hover:text-brand-300 font-medium"
          >
            {t("navigator.resetFilters") || "Filter zurücksetzen"}
          </button>
        </div>
      )}
    </div>
  );
}
