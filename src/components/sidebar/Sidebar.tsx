"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, BookOpen, CheckSquare, Calendar, Clock4, Brain,
  Timer, GraduationCap, BarChart2, Settings, Info, LogOut, Zap
} from "lucide-react";
import { clsx } from "clsx";

const NAV_GROUPS = [
  {
    label: "",
    items: [
      { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
      { href: "/modules",     icon: BookOpen,        label: "Module" },
      { href: "/tasks",       icon: CheckSquare,     label: "Aufgaben" },
    ],
  },
  {
    label: "PLANUNG",
    items: [
      { href: "/calendar",    icon: Calendar,    label: "Kalender" },
      { href: "/stundenplan", icon: Clock4,      label: "Stundenplan" },
      { href: "/exams",       icon: GraduationCap, label: "Prüfungen" },
    ],
  },
  {
    label: "WISSEN",
    items: [
      { href: "/knowledge",   icon: Brain,       label: "Lernziele" },
      { href: "/timer",       icon: Timer,       label: "Timer" },
    ],
  },
  {
    label: "ANALYSE",
    items: [
      { href: "/grades",      icon: BarChart2,   label: "Noten" },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/settings", icon: Settings, label: "Einstellungen" },
  { href: "/credits",  icon: Info,     label: "Über Semetra" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link href={href}
        className={clsx(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
          active
            ? "bg-violet-600 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}>
        <Icon size={18} className="shrink-0" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 h-screen bg-white border-r border-gray-100 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600 text-white text-lg shrink-0">📖</div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Semetra</p>
          <p className="text-[10px] text-gray-400 leading-tight">FH Edition</p>
        </div>
        <span className="ml-auto badge badge-violet text-[10px]">Free</span>
      </div>

      {/* Quick add */}
      <button className="flex items-center gap-2 w-full px-3 py-2.5 mb-4 rounded-xl border-2 border-dashed border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-50 transition-colors">
        <span className="text-lg leading-none">＋</span>
        Schnell hinzufügen
      </button>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {group.label && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase">
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
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut size={18} className="shrink-0" />
          Abmelden
        </button>
      </div>

      {/* Pro badge */}
      <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} />
          <span className="text-xs font-semibold">Semetra Pro</span>
        </div>
        <p className="text-[11px] text-violet-200 mb-2">KI-Coach, Cloud-Sync & mehr</p>
        <button className="w-full py-1.5 rounded-lg bg-white text-violet-700 text-xs font-semibold hover:bg-violet-50 transition-colors">
          Upgrade
        </button>
      </div>
    </aside>
  );
}
