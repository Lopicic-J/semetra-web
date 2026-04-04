"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Zap, Gem, Flame } from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { useTranslation } from "@/lib/i18n";
import { ProBadge } from "@/components/ui/ProGate";
import { NAV_GROUPS, BOTTOM_ITEMS, type NavItem as NavItemType } from "./nav-config";

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const { isPro } = useProfile();
  const streak = useStreaks();
  const { t } = useTranslation();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavItem({ href, icon: Icon, labelKey, pro }: NavItemType) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    const locked = pro && !isPro;

    return (
      <Link href={href}
        className={clsx(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
          active
            ? "bg-brand-600 text-white shadow-sm"
            : locked
              ? "text-surface-400 hover:bg-surface-50"
              : "text-surface-500 hover:bg-surface-100 hover:text-surface-800"
        )}>
        <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
        <span className="flex-1 truncate">{t(labelKey)}</span>
        {locked && !active && <ProBadge />}
      </Link>
    );
  }

  return (
    <aside className="flex flex-col w-[232px] shrink-0 h-screen bg-white border-r border-surface-200/60 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white shrink-0">
          <Gem size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-surface-900 text-sm leading-tight tracking-tight">Semetra Workspace</p>
          <p className="text-[10px] text-surface-400 leading-tight">Study Organizer</p>
        </div>
        <span className={clsx(
          "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0",
          isPro ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"
        )}>
          {isPro ? "PRO" : "Free"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5 -mr-0.5">
        {NAV_GROUPS.map((group, idx) => (
          <div key={group.labelKey}>
            {idx > 0 && group.labelKey && (
              <div className="border-t border-surface-100 mx-3 my-1" />
            )}
            {group.labelKey && (
              <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold text-surface-400 tracking-wider uppercase select-none">
                {t(group.labelKey)}
              </p>
            )}
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-2 pt-3 border-t border-surface-100 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => <NavItem key={item.href} {...item} />)}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-surface-400 hover:bg-danger-50 hover:text-danger-600 transition-all duration-150">
          <LogOut size={17} strokeWidth={1.8} className="shrink-0" />
          {t("sidebar.logout")}
        </button>
      </div>

      {/* Streak indicator */}
      {streak.currentStreak > 0 && (
        <Link href="/dashboard" className={clsx(
          "mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
          streak.todayDone
            ? "bg-orange-50 text-orange-700"
            : "bg-orange-50/50 text-orange-500"
        )}>
          <Flame size={15} className={streak.todayDone ? "text-orange-500" : "text-orange-300"} />
          <span>{t("sidebar.streak", { count: String(streak.currentStreak) })}</span>
          {!streak.todayDone && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
        </Link>
      )}

      {/* Upgrade / Pro badge */}
      {isPro ? (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
          <div className="flex items-center gap-2">
            <Zap size={13} />
            <span className="text-xs font-semibold">{t("sidebar.proActive")}</span>
          </div>
          <p className="text-[11px] text-brand-200 mt-1">{t("sidebar.allFeaturesUnlocked")}</p>
        </div>
      ) : (
        <Link href="/upgrade" className="mt-3 p-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white block hover:opacity-95 transition-opacity">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={13} />
            <span className="text-xs font-semibold">{t("sidebar.proUpgrade")}</span>
          </div>
          <p className="text-[11px] text-brand-200 mb-2.5">{t("sidebar.aiCoach")}</p>
          <div className="w-full py-1.5 rounded-lg bg-white/95 text-brand-700 text-xs font-semibold text-center hover:bg-white transition-colors">
            {t("sidebar.upgradePrice")}
          </div>
        </Link>
      )}
    </aside>
  );
}
