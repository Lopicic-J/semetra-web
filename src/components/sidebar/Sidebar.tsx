"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, BookOpen, CheckSquare, Calendar, Clock4, Brain,
  Timer, GraduationCap, BarChart2, Settings, LogOut, Zap,
  Award, Download, Info, Target, CalendarDays
} from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { ProBadge } from "@/components/ui/ProGate";

const NAV_GROUPS = [
  {
    label: "",
    items: [
      { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard",       pro: false },
      { href: "/modules",      icon: BookOpen,        label: "Module",          pro: false },
      { href: "/tasks",        icon: CheckSquare,     label: "Aufgaben",        pro: false },
    ],
  },
  {
    label: "PLANUNG",
    items: [
      { href: "/studienplan", icon: Target,          label: "Studienplan",     pro: false },
      { href: "/calendar",     icon: Calendar,        label: "Kalender",        pro: false },
      { href: "/timeline",     icon: CalendarDays,    label: "Timeline",        pro: false },
      { href: "/stundenplan",  icon: Clock4,          label: "Stundenplan",     pro: false },
      { href: "/exams",        icon: GraduationCap,   label: "Prüfungen",       pro: false },
    ],
  },
  {
    label: "WISSEN",
    items: [
      { href: "/knowledge",    icon: Brain,           label: "Lernziele",       pro: false },
      { href: "/timer",        icon: Timer,           label: "Timer",           pro: false },
    ],
  },
  {
    label: "ANALYSE",
    items: [
      { href: "/grades",       icon: BarChart2,       label: "Noten",           pro: false },
      { href: "/credits",      icon: Award,           label: "Credits & ECTS",  pro: false },
    ],
  },
  {
    label: "IMPORT",
    items: [
      { href: "/studiengaenge", icon: GraduationCap,  label: "Studiengänge",   pro: false },
      { href: "/scrap",          icon: Download,       label: "Portal Import",  pro: true  },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/settings", icon: Settings, label: "Einstellungen", pro: false },
  { href: "/about",    icon: Info,     label: "Über Semetra",  pro: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const { isPro } = useProfile();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavItem({ href, icon: Icon, label, pro }: {
    href: string;
    icon: React.ElementType;
    label: string;
    pro: boolean;
  }) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    const locked = pro && !isPro;

    return (
      <Link href={href}
        className={clsx(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
          active
            ? "bg-violet-600 text-white shadow-sm"
            : locked
              ? "text-gray-400 hover:bg-gray-50"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}>
        <Icon size={17} className="shrink-0" />
        <span className="flex-1">{label}</span>
        {locked && !active && <ProBadge />}
      </Link>
    );
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 h-screen bg-white border-r border-gray-100 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600 text-white text-lg shrink-0">S</div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Semetra</p>
          <p className="text-[10px] text-gray-400 leading-tight">Study Organizer</p>
        </div>
        <span className={clsx(
          "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full",
          isPro ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"
        )}>
          {isPro ? "PRO" : "Free"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {group.label && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-2 pt-3 border-t border-gray-100 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => <NavItem key={item.href} {...item} />)}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut size={17} className="shrink-0" />
          Abmelden
        </button>
      </div>

      {/* Upgrade / Pro badge */}
      {isPro ? (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Zap size={14} />
            <span className="text-xs font-semibold">Semetra Pro aktiv</span>
          </div>
          <p className="text-[11px] text-violet-200 mt-1">Alle Features freigeschaltet</p>
        </div>
      ) : (
        <Link href="/upgrade" className="mt-3 p-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white block hover:opacity-90 transition-opacity">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} />
            <span className="text-xs font-semibold">Semetra Pro</span>
          </div>
          <p className="text-[11px] text-violet-200 mb-2">KI-Coach, Sync & mehr</p>
          <div className="w-full py-1.5 rounded-lg bg-white text-violet-700 text-xs font-semibold text-center hover:bg-violet-50 transition-colors">
            Upgrade — CHF 9.90/Mt.
          </div>
        </Link>
      )}
    </aside>
  );
}
