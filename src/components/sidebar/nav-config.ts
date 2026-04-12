import {
  LayoutDashboard, BookOpen, Calendar, GraduationCap,
  Brain, TrendingUp, Wrench, Compass, Users, MessageCircle,
  Shield, Settings, UserCircle, Terminal, Puzzle, ClipboardList,
  Dna, Trophy, FileText,
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
  // ── Hauptbereich ──
  {
    labelKey: "",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard", pro: false },
      { href: "/navigator", icon: Compass, labelKey: "nav.navigator", pro: false },
    ],
  },

  // ── Studium ──
  {
    labelKey: "navGroup.study",
    items: [
      {
        href: "/modules",
        icon: BookOpen,
        labelKey: "nav.modulmanager",
        pro: false,
        children: [
          { href: "/modules", labelKey: "nav.modules" },
          { href: "/tasks", labelKey: "nav.tasks" },
          { href: "/studienplan", labelKey: "nav.studienplan" },
        ],
      },
      {
        href: "/calendar",
        icon: Calendar,
        labelKey: "nav.schedule",
        pro: false,
        children: [
          { href: "/calendar", labelKey: "nav.calendar" },
          { href: "/stundenplan", labelKey: "nav.stundenplan" },
          { href: "/smart", labelKey: "nav.smartSchedule" },
        ],
      },
      {
        href: "/exams",
        icon: ClipboardList,
        labelKey: "nav.pruefungsmanager",
        pro: false,
        children: [
          { href: "/exams", labelKey: "nav.exams" },
          { href: "/noten", labelKey: "nav.grades" },
          { href: "/intelligence", labelKey: "nav.examIntelligence" },
        ],
      },
      {
        href: "/overview",
        icon: GraduationCap,
        labelKey: "nav.studium",
        pro: false,
        children: [
          { href: "/overview", labelKey: "nav.overview" },
          { href: "/transcript", labelKey: "nav.transcript" },
          { href: "/anrechnungen", labelKey: "nav.recognition" },
          { href: "/trends", labelKey: "nav.trends" },
        ],
      },
    ],
  },

  // ── Lernen ──
  {
    labelKey: "navGroup.learning",
    items: [
      {
        href: "/lernplan",
        icon: Brain,
        labelKey: "nav.learning",
        pro: false,
        children: [
          { href: "/lernplan", labelKey: "nav.lernplan" },
          { href: "/knowledge", labelKey: "nav.knowledge" },
          { href: "/timer", labelKey: "nav.timer" },
          { href: "/flashcards", labelKey: "nav.flashcards" },
          { href: "/mathe", labelKey: "nav.math" },
        ],
      },
      {
        href: "/notes",
        icon: FileText,
        labelKey: "nav.materialien",
        pro: false,
        children: [
          { href: "/notes", labelKey: "nav.notes" },
          { href: "/documents", labelKey: "nav.documents" },
        ],
      },
      {
        href: "/ki",
        icon: Wrench,
        labelKey: "nav.werkzeuge",
        pro: false,
        children: [
          { href: "/ki", labelKey: "nav.aiAssistant" },
          { href: "/mindmaps", labelKey: "nav.mindmaps" },
          { href: "/brainstorming", labelKey: "nav.brainstorming" },
        ],
      },
    ],
  },

  // ── Persönlichkeit ──
  {
    labelKey: "navGroup.personality",
    items: [
      {
        href: "/dna",
        icon: Dna,
        labelKey: "nav.dna",
        pro: false,
        children: [
          { href: "/dna", labelKey: "nav.lernDna" },
          { href: "/patterns", labelKey: "nav.patterns" },
          { href: "/timeline", labelKey: "nav.timeline" },
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
          { href: "/review", labelKey: "nav.weeklyReview" },
        ],
      },
    ],
  },

  // ── Soziales ──
  {
    labelKey: "navGroup.social",
    items: [
      { href: "/community", icon: Users, labelKey: "nav.community", pro: false },
      { href: "/friends", icon: Users, labelKey: "nav.friends", pro: false },
      { href: "/groups", icon: Users, labelKey: "nav.groups", pro: false },
      { href: "/messages", icon: MessageCircle, labelKey: "nav.messages", pro: false },
    ],
  },

  // ── Verwaltung (Admin/Institution) ──
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
