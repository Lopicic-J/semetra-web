import {
  LayoutDashboard, BookOpen, Calendar, GraduationCap,
  Brain, TrendingUp, Wrench, Compass, Users, MessageCircle,
  Shield, Settings, UserCircle, Terminal, Puzzle, ClipboardList,
  Dna, Trophy, Fingerprint,
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
  /** Sub-items shown as pinnable quick-links */
  children?: { href: string; labelKey: string; tab?: string }[];
}

export interface NavGroup {
  /** i18n key for group label, empty string = no label */
  labelKey: string;
  items: NavItem[];
  /** If set, entire group only visible to users with one of these builder roles */
  requiredRoles?: UserRole[];
}

export const NAV_GROUPS: NavGroup[] = [
  // ── Hauptbereich ──
  {
    labelKey: "",
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        labelKey: "nav.dashboard",
        pro: false,
      },
      {
        href: "/navigator",
        icon: Compass,
        labelKey: "nav.navigator",
        pro: false,
      },
    ],
  },
  // ── Studium ──
  {
    labelKey: "navGroup.study",
    items: [
      {
        href: "/modules",
        icon: BookOpen,
        labelKey: "nav.modules",
        pro: false,
        children: [
          { href: "/modules", labelKey: "nav.modules" },
          { href: "/tasks", labelKey: "nav.tasks" },
        ],
      },
      {
        href: "/schedule",
        icon: Calendar,
        labelKey: "nav.schedule",
        pro: false,
        children: [
          { href: "/schedule?tab=smart", labelKey: "nav.smartSchedule", tab: "smart" },
          { href: "/schedule?tab=calendar", labelKey: "nav.calendar", tab: "calendar" },
          { href: "/schedule?tab=stundenplan", labelKey: "nav.stundenplan", tab: "stundenplan" },
        ],
      },
      {
        href: "/exams",
        icon: ClipboardList,
        labelKey: "nav.pruefungen",
        pro: false,
        children: [
          { href: "/exams", labelKey: "nav.exams" },
          { href: "/exams?tab=intelligence", labelKey: "nav.examIntelligence", tab: "intelligence" },
          { href: "/studium?tab=noten", labelKey: "nav.grades", tab: "noten" },
          { href: "/studium?tab=studienplan", labelKey: "nav.studienplan", tab: "studienplan" },
          { href: "/studium?tab=transcript", labelKey: "nav.transcript", tab: "transcript" },
          { href: "/studium?tab=anrechnungen", labelKey: "nav.recognition", tab: "anrechnungen" },
        ],
      },
    ],
  },
  // ── Lernen ──
  {
    labelKey: "navGroup.learning",
    items: [
      {
        href: "/learning",
        icon: Brain,
        labelKey: "nav.learning",
        pro: false,
        children: [
          { href: "/learning?tab=timer", labelKey: "nav.timer", tab: "timer" },
          { href: "/learning?tab=materials", labelKey: "nav.materials", tab: "materials" },
        ],
      },
      {
        href: "/werkzeuge",
        icon: Wrench,
        labelKey: "nav.werkzeuge",
        pro: false,
        children: [
          { href: "/werkzeuge?tab=ki", labelKey: "nav.aiAssistant", tab: "ki" },
          { href: "/werkzeuge?tab=mindmaps", labelKey: "nav.mindmaps", tab: "mindmaps" },
          { href: "/werkzeuge?tab=brainstorming", labelKey: "nav.brainstorming", tab: "brainstorming" },
          { href: "/werkzeuge?tab=mathe", labelKey: "nav.math", tab: "mathe" },
        ],
      },
    ],
  },
  // ── Persönlichkeit ──
  {
    labelKey: "navGroup.personality",
    items: [
      {
        href: "/fortschritt",
        icon: Dna,
        labelKey: "nav.dna",
        pro: false,
        children: [
          { href: "/fortschritt?tab=dna", labelKey: "nav.lernDna", tab: "dna" },
          { href: "/fortschritt?tab=insights", labelKey: "nav.insights", tab: "insights" },
        ],
      },
      {
        href: "/fortschritt?tab=erfolge",
        icon: Trophy,
        labelKey: "nav.leistung",
        pro: false,
        children: [
          { href: "/fortschritt?tab=erfolge", labelKey: "nav.achievements", tab: "erfolge" },
          { href: "/fortschritt?tab=bestenliste", labelKey: "nav.leaderboard", tab: "bestenliste" },
          { href: "/fortschritt?tab=trends", labelKey: "nav.trends", tab: "trends" },
        ],
      },
    ],
  },
  // ── Soziales ──
  {
    labelKey: "navGroup.social",
    items: [
      {
        href: "/community",
        icon: Users,
        labelKey: "nav.community",
        pro: false,
        children: [
          { href: "/community", labelKey: "nav.community" },
          { href: "/friends", labelKey: "nav.friends" },
          { href: "/groups", labelKey: "nav.groups" },
        ],
      },
      {
        href: "/messages",
        icon: MessageCircle,
        labelKey: "nav.messages",
        pro: false,
      },
    ],
  },
  // ── Verwaltung (Admin) — only visible to admins/institutions ──
  {
    labelKey: "navGroup.admin",
    requiredRoles: ["admin", "institution"],
    items: [
      { href: "/builder", icon: Wrench, labelKey: "nav.builder", pro: false },
      { href: "/admin", icon: Shield, labelKey: "nav.admin", pro: false, requiredRoles: ["admin", "institution"] },
      { href: "/developer", icon: Terminal, labelKey: "nav.developer", pro: false, requiredRoles: ["admin"] },
      { href: "/plugins", icon: Puzzle, labelKey: "nav.plugins", pro: false },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { href: "/profile", icon: UserCircle, labelKey: "nav.profile", pro: false },
  { href: "/settings", icon: Settings, labelKey: "nav.settings", pro: false },
];

/**
 * Filter nav groups based on the user's builder role.
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

/**
 * All pinnable sub-items across all nav items.
 * Used by the pin/favorites feature.
 */
export function getAllPinnableItems(): { href: string; labelKey: string; parentLabelKey: string }[] {
  return NAV_GROUPS.flatMap(g =>
    g.items.flatMap(item =>
      (item.children ?? []).map(child => ({
        href: child.href,
        labelKey: child.labelKey,
        parentLabelKey: item.labelKey,
      }))
    )
  );
}
