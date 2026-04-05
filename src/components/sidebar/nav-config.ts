import {
  LayoutDashboard, Compass, BookOpen, CheckSquare,
  Target, Calendar, BarChart3, Clock3, Award, CalendarClock, Users, Trophy,
  FileText, FolderOpen, Brain, Network, Lightbulb, Layers, Calculator, Timer,
  TrendingUp, Medal, Sparkles, ClipboardList, GraduationCap, Wrench, Code, Puzzle,
  Settings, Info, UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  /** i18n key — resolved at render time via useTranslation().t() */
  labelKey: string;
  pro: boolean;
}

export interface NavGroup {
  /** i18n key for group label, empty string = no label */
  labelKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  // Group 1: Übersicht (no label)
  {
    labelKey: "",
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, labelKey: "nav.dashboard",  pro: false },
      { href: "/navigator",  icon: Compass,         labelKey: "nav.navigator",  pro: false },
    ],
  },
  // Group 2: Studium
  {
    labelKey: "navGroup.study",
    items: [
      { href: "/modules",    icon: BookOpen,  labelKey: "nav.modules",     pro: false },
      { href: "/tasks",      icon: CheckSquare, labelKey: "nav.tasks",       pro: false },
      { href: "/calendar",   icon: Calendar,  labelKey: "nav.calendar",    pro: false },
      { href: "/stundenplan", icon: Clock3,    labelKey: "nav.stundenplan", pro: false },
      { href: "/exams",      icon: Award,     labelKey: "nav.exams",       pro: false },
    ],
  },
  // Group 3: Lernen
  {
    labelKey: "navGroup.learning",
    items: [
      { href: "/lernplan",       icon: CalendarClock, labelKey: "nav.lernplan",      pro: false },
      { href: "/flashcards",    icon: Layers,      labelKey: "nav.flashcards",    pro: false },
      { href: "/knowledge",     icon: Brain,       labelKey: "nav.knowledge",     pro: false },
      { href: "/notes",         icon: FileText,    labelKey: "nav.notes",         pro: false },
      { href: "/documents",     icon: FolderOpen,  labelKey: "nav.documents",     pro: false },
      { href: "/groups",        icon: Users,       labelKey: "nav.groups",        pro: false },
      { href: "/timer",         icon: Timer,       labelKey: "nav.timer",         pro: false },
    ],
  },
  // Group 4: Werkzeuge
  {
    labelKey: "navGroup.tools",
    items: [
      { href: "/ai-assistant",  icon: Sparkles,    labelKey: "nav.aiAssistant",   pro: false },
      { href: "/mindmaps",      icon: Network,     labelKey: "nav.mindmaps",      pro: false },
      { href: "/brainstorming", icon: Lightbulb,   labelKey: "nav.brainstorming", pro: false },
      { href: "/math",          icon: Calculator,  labelKey: "nav.math",          pro: false },
    ],
  },
  // Group 5: Fortschritt
  {
    labelKey: "navGroup.progress",
    items: [
      { href: "/studienplan", icon: Target,         labelKey: "nav.studienplan",  pro: false },
      { href: "/grades",      icon: TrendingUp,    labelKey: "nav.grades",       pro: false },
      { href: "/credits",     icon: Medal,          labelKey: "nav.credits",      pro: false },
      { href: "/transcript",  icon: ClipboardList,  labelKey: "nav.transcript",   pro: false },
      { href: "/progress",    icon: GraduationCap,  labelKey: "nav.progress",     pro: false },
      { href: "/timeline",      icon: BarChart3,      labelKey: "nav.timeline",      pro: false },
      { href: "/achievements",  icon: Trophy,         labelKey: "nav.achievements",  pro: false },
      { href: "/leaderboard",   icon: Medal,          labelKey: "nav.leaderboard",   pro: false },
    ],
  },
  // Group 6: Builder (Admin)
  {
    labelKey: "navGroup.builder",
    items: [
      { href: "/builder",     icon: Wrench,        labelKey: "nav.builder",      pro: false },
      { href: "/plugins",     icon: Puzzle,        labelKey: "nav.plugins",      pro: false },
      { href: "/developer",   icon: Code,          labelKey: "nav.developer",    pro: true  },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/profile",  icon: UserCircle, labelKey: "nav.profile",  pro: false },
  { href: "/settings", icon: Settings,   labelKey: "nav.settings", pro: false },
  { href: "/about",    icon: Info,       labelKey: "nav.about",    pro: false },
];

export function getAllNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
}
