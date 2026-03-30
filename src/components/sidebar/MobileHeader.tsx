"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, LogOut, Zap } from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { ProBadge } from "@/components/ui/ProGate";

const NAV_GROUPS = [
  {
    label: "",
    items: [
      { href: "/dashboard",    emoji: "\u{1F3E0}\uFE0F", label: "Dashboard",       pro: false },
      { href: "/modules",      emoji: "\u{1F4DA}\uFE0F", label: "Module",          pro: false },
      { href: "/tasks",        emoji: "\u2705\uFE0F",     label: "Aufgaben",        pro: false },
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
      { href: "/knowledge",    emoji: "\u{1F9E0}\uFE0F", label: "Lernziele",       pro: false },
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
  {
    label: "IMPORT",
    items: [
      { href: "/studiengaenge", emoji: "\u{1F393}\uFE0F", label: "FH-Voreinstellungen", pro: true },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/settings", emoji: "\u2699\uFE0F",     label: "Einstellungen", pro: false },
  { href: "/about",    emoji: "\u2139\uFE0F",     label: "Über Semetra",  pro: false },
];

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro } = useProfile();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Find current page label
  const allItems = [...NAV_GROUPS.flatMap(g => g.items), ...BOTTOM_ITEMS];
  const currentPage = allItems.find(
    i => pathname === i.href || (i.href !== "/dashboard" && pathname.startsWith(i.href))
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Menu size={22} className="text-gray-700" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base">{"\u{1F4D6}\uFE0F"}</span>
          <span className="font-bold text-gray-900 text-sm">Semetra</span>
          <span className={clsx(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
            isPro ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"
          )}>
            {isPro ? "PRO" : "Free"}
          </span>
        </div>

        {/* Current page indicator or empty spacer */}
        <div className="w-10" />
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out sidebar */}
      <aside
        className={clsx(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600 text-white text-lg shrink-0">
              <span className="text-base">{"\u{1F4D6}\uFE0F"}</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Semetra</p>
              <p className="text-[10px] text-gray-400 leading-tight">Study Organizer</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {group.label && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const locked = item.pro && !isPro;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-violet-600 text-white shadow-sm"
                        : locked
                          ? "text-gray-400 hover:bg-gray-50"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <span className="text-base shrink-0 w-5 text-center leading-none">{item.emoji}</span>
                    <span className="flex-1">{item.label}</span>
                    {locked && !active && <ProBadge />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pt-2 pb-3 border-t border-gray-100 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <span className="text-base shrink-0 w-5 text-center leading-none">{item.emoji}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} className="shrink-0 ml-0.5" />
            Abmelden
          </button>
        </div>

        {/* Upgrade / Pro badge */}
        <div className="px-3 pb-4">
          {isPro ? (
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <div className="flex items-center gap-2">
                <Zap size={14} />
                <span className="text-xs font-semibold">Semetra Pro aktiv</span>
              </div>
              <p className="text-[11px] text-violet-200 mt-1">Alle Features freigeschaltet</p>
            </div>
          ) : (
            <Link
              href="/upgrade"
              onClick={() => setOpen(false)}
              className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white block hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} />
                <span className="text-xs font-semibold">Semetra Pro</span>
              </div>
              <p className="text-[11px] text-violet-200 mb-2">KI-Coach, Sync & mehr</p>
              <div className="w-full py-1.5 rounded-lg bg-white text-violet-700 text-xs font-semibold text-center">
                Upgrade — ab CHF 3.33/Mt.
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
