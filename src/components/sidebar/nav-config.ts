import {
  LayoutDashboard, BookOpen, Calendar, GraduationCap,
  Brain, TrendingUp, Wrench, Users, MessageCircle,
  Shield, Settings, UserCircle, Terminal, Puzzle, ClipboardList,
  Dna, Trophy, FileText, Timer, CheckSquare, Zap,
  Sparkles, Target, BarChart3, FolderOpen,
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
  children?: { href: string; labelKey: string }[];
}

export interface NavGroup {
  /** i18n key for group label, empty string = no label */
  labelKey: string;
  items: NavItem[];
  /** If set, entire group only visible to users with one of these builder roles */
  requiredRoles?: UserRole[];
}

export const NAV_GROUPS: NavGroup[] = [
  // ══════════════════════════════════════════════════════════
  // KERN — 5 Hauptaktionen, immer sichtbar, kein Expandable
  // Das ist alles was ein Student täglich braucht.
  // ══════════════════════════════════════════════════════════
  {
    labelKey: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard", pro: false },
      { href: "/guided-session", icon: Sparkles, labelKey: "nav.guidedSession", pro: false },
      { href: "/timer", icon: Timer, labelKey: "nav.timer", pro: false },
      { href: "/tasks", icon: CheckSquare, labelKey: "nav.tasks", pro: false },
      {
        href: "/modules",
        icon: BookOpen,
        labelKey: "nav.studium",
        pro: false,
        children: [
          { href: "/modules", labelKey: "nav.modules" },
          { href: "/noten", labelKey: "nav.grades" },
          { href: "/exams", labelKey: "nav.exams" },
          { href: "/calendar", labelKey: "nav.calendar" },
          { href: "/stundenplan", labelKey: "nav.stundenplan" },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // MEHR — Erweiterte Features, 1 Klick entfernt
  // Alles was der Student regelmässig aber nicht täglich braucht.
  // ══════════════════════════════════════════════════════════
  {
    labelKey: "navGroup.more",
    items: [
      {
        href: "/flashcards",
        icon: Zap,
        labelKey: "nav.flashcards",
        pro: false,
        children: [
          { href: "/flashcards", labelKey: "nav.flashcards" },
          { href: "/flashcards/community", labelKey: "community.flashcards" },
        ],
      },
      {
        href: "/exam-prep",
        icon: Target,
        labelKey: "nav.examPrep",
        pro: false,
        children: [
          { href: "/exam-prep", labelKey: "nav.prepPlan" },
          { href: "/exam-simulator", labelKey: "nav.examSimulator" },
          { href: "/intelligence", labelKey: "nav.examIntelligence" },
        ],
      },
      { href: "/ki", icon: Brain, labelKey: "nav.aiAssistant", pro: false },
      {
        href: "/notes",
        icon: FileText,
        labelKey: "nav.materialien",
        pro: false,
        children: [
          { href: "/notes", labelKey: "nav.notes" },
          { href: "/documents", labelKey: "nav.documents" },
          { href: "/mindmaps", labelKey: "nav.mindmaps" },
        ],
      },
      {
        href: "/dna",
        icon: Dna,
        labelKey: "nav.lernDna",
        pro: false,
        children: [
          { href: "/dna", labelKey: "nav.dnaProfile" },
          { href: "/patterns", labelKey: "nav.patterns" },
          { href: "/review", labelKey: "nav.weeklyReview" },
          { href: "/reflections", labelKey: "nav.reflections" },
          { href: "/wellness", labelKey: "nav.wellness" },
        ],
      },
      {
        href: "/erfolge",
        icon: Trophy,
        labelKey: "nav.leistung",
        pro: false,
        children: [
          { href: "/erfolge", labelKey: "nav.achievements" },
          { href: "/bestenliste", labelKey: "nav.leaderboard" },
          { href: "/challenges", labelKey: "nav.challenges" },
          { href: "/semester-review", labelKey: "nav.semesterReview" },
        ],
      },
      {
        href: "/groups",
        icon: Users,
        labelKey: "nav.soziales",
        pro: false,
        children: [
          { href: "/groups", labelKey: "nav.groups" },
          { href: "/messages", labelKey: "nav.messages" },
          { href: "/friends", labelKey: "nav.friends" },
          { href: "/community", labelKey: "nav.community" },
        ],
      },
      {
        href: "/overview",
        icon: BarChart3,
        labelKey: "nav.fortschritt",
        pro: false,
        children: [
          { href: "/overview", labelKey: "nav.overview" },
          { href: "/transcript", labelKey: "nav.transcript" },
          { href: "/trends", labelKey: "nav.trends" },
          { href: "/lernnachweis", labelKey: "nav.lernnachweis" },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // VERWALTUNG — Nur für Admins/Institutionen
  // ══════════════════════════════════════════════════════════
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
