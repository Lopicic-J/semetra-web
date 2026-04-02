export interface NavItem {
  href: string;
  emoji: string;
  label: string;
  pro: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard",      emoji: "\u{1F3E0}\uFE0F", label: "Dashboard",           pro: false },
      { href: "/modules",        emoji: "\u{1F4DA}\uFE0F", label: "Module",              pro: false },
      { href: "/studiengaenge",  emoji: "\u{1F393}\uFE0F", label: "FH-Voreinstellungen", pro: true },
      { href: "/tasks",          emoji: "\u2705\uFE0F",     label: "Aufgaben",            pro: false },
    ],
  },
  {
    label: "PLANUNG",
    items: [
      { href: "/studienplan", emoji: "\u{1F3AF}\uFE0F", label: "Studienplan",     pro: false },
      { href: "/calendar",     emoji: "\u{1F4C5}\uFE0F", label: "Kalender",        pro: false },
      { href: "/timeline",     emoji: "\u{1F4CA}\uFE0F", label: "Timeline",        pro: false },
      { href: "/stundenplan",  emoji: "\u{1F5D3}\uFE0F", label: "Stundenplan",     pro: false },
      { href: "/exams",        emoji: "\u{1F393}\uFE0F", label: "Prüfungen",       pro: false },
    ],
  },
  {
    label: "WISSEN",
    items: [
      { href: "/notes",        emoji: "\u{1F4DD}\uFE0F", label: "Notizen",         pro: false },
      { href: "/documents",    emoji: "\u{1F4C2}\uFE0F", label: "Dokumente",       pro: false },
      { href: "/knowledge",    emoji: "\u{1F9E0}\uFE0F", label: "Lernziele",       pro: false },
      { href: "/mindmaps",    emoji: "\u{1F5FA}\uFE0F", label: "Mind Maps",       pro: false },
      { href: "/brainstorming", emoji: "\u{1F4A1}\uFE0F", label: "Brainstorming",  pro: false },
      { href: "/flashcards",   emoji: "\u{1F4C7}\uFE0F", label: "Karteikarten",    pro: false },
      { href: "/math",         emoji: "\u{1F9EE}\uFE0F", label: "Mathe-Raum",      pro: false },
      { href: "/timer",        emoji: "\u23F1\uFE0F",     label: "Timer",           pro: false },
    ],
  },
  {
    label: "ANALYSE",
    items: [
      { href: "/grades",       emoji: "\u{1F4C8}\uFE0F", label: "Noten",           pro: false },
      { href: "/credits",      emoji: "\u{1F3C6}\uFE0F", label: "Credits & ECTS",  pro: false },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", emoji: "\u2699\uFE0F",     label: "Einstellungen", pro: false },
  { href: "/about",    emoji: "\u2139\uFE0F",     label: "Über Semetra",  pro: false },
];

export function getAllNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
}
