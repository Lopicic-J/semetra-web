import {
  LayoutDashboard, Compass, BookOpen, CheckSquare,
  Target, Calendar, BarChart3, Clock3, Award,
  FileText, FolderOpen, Brain, Network, Lightbulb, Layers, Calculator, Timer,
  TrendingUp, Medal,
  Settings, Info,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
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
      { href: "/dashboard",      icon: LayoutDashboard, label: "Dashboard",           pro: false },
      { href: "/navigator",      icon: Compass,         label: "Navigator",           pro: false },
      { href: "/modules",        icon: BookOpen,        label: "Module",              pro: false },
      { href: "/tasks",          icon: CheckSquare,     label: "Aufgaben",            pro: false },
    ],
  },
  {
    label: "Planung",
    items: [
      { href: "/studienplan",  icon: Target,     label: "Studienplan",    pro: false },
      { href: "/calendar",     icon: Calendar,   label: "Kalender",       pro: false },
      { href: "/timeline",     icon: BarChart3,  label: "Timeline",       pro: false },
      { href: "/stundenplan",  icon: Clock3,     label: "Stundenplan",    pro: false },
      { href: "/exams",        icon: Award,      label: "Prüfungen",      pro: false },
    ],
  },
  {
    label: "Wissen",
    items: [
      { href: "/notes",         icon: FileText,    label: "Notizen",        pro: false },
      { href: "/documents",     icon: FolderOpen,  label: "Dokumente",      pro: false },
      { href: "/knowledge",     icon: Brain,       label: "Lernziele",      pro: false },
      { href: "/mindmaps",      icon: Network,     label: "Mind Maps",      pro: false },
      { href: "/brainstorming", icon: Lightbulb,   label: "Brainstorming",  pro: false },
      { href: "/flashcards",    icon: Layers,      label: "Karteikarten",   pro: false },
      { href: "/math",          icon: Calculator,  label: "Mathe-Raum",     pro: false },
      { href: "/timer",         icon: Timer,       label: "Timer",          pro: false },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/grades",   icon: TrendingUp,  label: "Noten",          pro: false },
      { href: "/credits",  icon: Medal,        label: "Credits & ECTS", pro: false },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", icon: Settings, label: "Einstellungen", pro: false },
  { href: "/about",    icon: Info,     label: "Über Semetra",  pro: false },
];

export function getAllNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
}
