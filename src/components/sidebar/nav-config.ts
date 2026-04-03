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
  {
    labelKey: "",
    items: [
      { href: "/dashboard",      icon: LayoutDashboard, labelKey: "nav.dashboard",      pro: false },
      { href: "/navigator",      icon: Compass,         labelKey: "nav.navigator",      pro: false },
      { href: "/modules",        icon: BookOpen,        labelKey: "nav.modules",        pro: false },
      { href: "/tasks",          icon: CheckSquare,     labelKey: "nav.tasks",          pro: false },
    ],
  },
  {
    labelKey: "navGroup.planning",
    items: [
      { href: "/studienplan",  icon: Target,     labelKey: "nav.studienplan",  pro: false },
      { href: "/calendar",     icon: Calendar,   labelKey: "nav.calendar",     pro: false },
      { href: "/timeline",     icon: BarChart3,  labelKey: "nav.timeline",     pro: false },
      { href: "/stundenplan",  icon: Clock3,     labelKey: "nav.stundenplan",  pro: false },
      { href: "/exams",        icon: Award,      labelKey: "nav.exams",        pro: false },
    ],
  },
  {
    labelKey: "navGroup.knowledge",
    items: [
      { href: "/notes",         icon: FileText,    labelKey: "nav.notes",         pro: false },
      { href: "/documents",     icon: FolderOpen,  labelKey: "nav.documents",     pro: false },
      { href: "/knowledge",     icon: Brain,       labelKey: "nav.knowledge",     pro: false },
      { href: "/mindmaps",      icon: Network,     labelKey: "nav.mindmaps",      pro: false },
      { href: "/brainstorming", icon: Lightbulb,   labelKey: "nav.brainstorming", pro: false },
      { href: "/flashcards",    icon: Layers,      labelKey: "nav.flashcards",    pro: false },
      { href: "/math",          icon: Calculator,  labelKey: "nav.math",          pro: false },
      { href: "/timer",         icon: Timer,       labelKey: "nav.timer",         pro: false },
    ],
  },
  {
    labelKey: "navGroup.analytics",
    items: [
      { href: "/grades",   icon: TrendingUp,  labelKey: "nav.grades",   pro: false },
      { href: "/credits",  icon: Medal,        labelKey: "nav.credits",  pro: false },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", icon: Settings, labelKey: "nav.settings", pro: false },
  { href: "/about",    icon: Info,     labelKey: "nav.about",    pro: false },
];

export function getAllNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
}
