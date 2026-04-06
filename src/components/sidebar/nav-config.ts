import {
  LayoutDashboard, BookOpen, CheckSquare,
  Calendar, Award, CalendarClock, Users, Trophy,
  FileText, Brain, Network, Calculator, Timer,
  TrendingUp, Sparkles, GraduationCap, Wrench, Code, Puzzle,
  Shield, Settings, UserCircle, Terminal, Zap, BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/hooks/useProfile";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  /** i18n key — resolved at render time via useTranslation().t() */
  labelKey: string;
  pro: boolean;
  /** If set, item is only visible to users with one of these builder roles */
  requiredRoles?: UserRole[];
}

export interface NavGroup {
  /** i18n key for group label, empty string = no label */
  labelKey: string;
  items: NavItem[];
  /** If set, entire group only visible to users with one of these builder roles */
  requiredRoles?: UserRole[];
}

export const NAV_GROUPS: NavGroup[] = [
  // ── Übersicht (no label) ──
  {
    labelKey: "",
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, labelKey: "nav.dashboard",  pro: false },
    ],
  },
  // ── Studium ──
  {
    labelKey: "navGroup.study",
    items: [
      { href: "/modules",         icon: BookOpen,     labelKey: "nav.modules",        pro: false },
      { href: "/tasks",           icon: CheckSquare,  labelKey: "nav.tasks",          pro: false },
      { href: "/smart-schedule",  icon: Zap,          labelKey: "nav.smartSchedule",  pro: false },
      { href: "/schedule",        icon: Calendar,     labelKey: "nav.schedule",       pro: false },
      { href: "/exams",           icon: Award,        labelKey: "nav.exams",          pro: false },
    ],
  },
  // ── Lernen ──
  {
    labelKey: "navGroup.learning",
    items: [
      { href: "/learning",   icon: Brain,        labelKey: "nav.learning",    pro: false },
      { href: "/materials",  icon: FileText,     labelKey: "nav.materials",   pro: false },
      { href: "/groups",     icon: Users,        labelKey: "nav.groups",      pro: false },
    ],
  },
  // ── Werkzeuge ──
  {
    labelKey: "navGroup.tools",
    items: [
      { href: "/ai-assistant",  icon: Sparkles,   labelKey: "nav.aiAssistant",   pro: false },
      { href: "/creative",      icon: Network,    labelKey: "nav.creative",      pro: false },
      { href: "/math",          icon: Calculator, labelKey: "nav.math",          pro: false },
    ],
  },
  // ── Fortschritt ──
  {
    labelKey: "navGroup.progress",
    items: [
      { href: "/studium",       icon: GraduationCap, labelKey: "nav.studium",      pro: false },
      { href: "/insights",      icon: BarChart3,     labelKey: "nav.insights",     pro: false },
      { href: "/achievements",  icon: Trophy,        labelKey: "nav.achievements", pro: false },
    ],
  },
  // ── Verwaltung (Admin) — only visible to admins ──
  {
    labelKey: "navGroup.admin",
    requiredRoles: ["admin", "institution"],
    items: [
      { href: "/builder",       icon: Wrench, labelKey: "nav.builder",      pro: false },
      { href: "/admin",         icon: Shield, labelKey: "nav.admin",        pro: false, requiredRoles: ["admin", "institution"] },
      { href: "/developer",    icon: Terminal, labelKey: "nav.developer",   pro: false, requiredRoles: ["admin"] },
      { href: "/plugins",       icon: Puzzle, labelKey: "nav.plugins",      pro: false },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/profile",  icon: UserCircle, labelKey: "nav.profile",  pro: false },
  { href: "/settings", icon: Settings,   labelKey: "nav.settings", pro: false },
];

/**
 * Filter nav groups based on the user's builder role.
 * Groups and items with requiredRoles are only included if the user has one of the listed roles.
 */
export function getFilteredNavGroups(userRole: UserRole): NavGroup[] {
  return NAV_GROUPS
    .filter((g) => !g.requiredRoles || g.requiredRoles.includes(userRole))
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => !item.requiredRoles || item.requiredRoles.includes(userRole),
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export function getAllNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
}
