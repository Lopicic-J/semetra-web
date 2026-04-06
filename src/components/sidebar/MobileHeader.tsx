"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, LogOut, Zap, Gem } from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { useTranslation } from "@/lib/i18n";
import { ProBadge } from "@/components/ui/ProGate";
import { BOTTOM_ITEMS, getFilteredNavGroups, getAllNavItems } from "./nav-config";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro, userRole } = useProfile();
  const { t } = useTranslation();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const allItems = getAllNavItems();
  const currentPage = allItems.find(
    i => pathname === i.href || (i.href !== "/dashboard" && pathname.startsWith(i.href))
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-50 border-b border-surface-200/60 shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-surface-100 transition-colors"
        >
          <Menu size={20} className="text-surface-600" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-600 text-white">
            <Gem size={12} strokeWidth={2.2} />
          </div>
          <span className="font-bold text-surface-900 text-sm tracking-tight">Semetra Workspace</span>
          <span className={clsx(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
            isPro ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"
          )}>
            {isPro ? "PRO" : "Free"}
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-surface-900/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out sidebar */}
      <aside
        className={clsx(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[rgb(var(--card-bg))] shadow-xl transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white shrink-0">
              <Gem size={16} strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-bold text-surface-900 text-sm leading-tight tracking-tight">Semetra Workspace</p>
              <p className="text-[10px] text-surface-400 leading-tight">{t("sidebar.study")}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-surface-100 transition-colors"
          >
            <X size={18} className="text-surface-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {getFilteredNavGroups(userRole).map((group) => (
            <div key={group.labelKey}>
              {group.labelKey && (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold text-surface-400 tracking-wider uppercase select-none">
                  {t(group.labelKey)}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const locked = item.pro && !isPro;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : locked
                          ? "text-surface-400 hover:bg-surface-50"
                          : "text-surface-500 hover:bg-surface-100 hover:text-surface-800"
                    )}
                  >
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {locked && !active && <ProBadge />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pt-2 pb-3 border-t border-surface-100 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-surface-500 hover:bg-surface-100 hover:text-surface-800"
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-surface-400 hover:bg-danger-50 hover:text-danger-600 transition-all duration-150"
          >
            <LogOut size={17} strokeWidth={1.8} className="shrink-0" />
            {t("sidebar.logout")}
          </button>
        </div>

        {/* Upgrade / Pro badge */}
        <div className="px-3 pb-4">
          {isPro ? (
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
              <div className="flex items-center gap-2">
                <Zap size={13} />
                <span className="text-xs font-semibold">{t("sidebar.proActive")}</span>
              </div>
              <p className="text-[11px] text-brand-200 mt-1">{t("sidebar.allFeaturesUnlocked")}</p>
            </div>
          ) : (
            <Link
              href="/upgrade"
              onClick={() => setOpen(false)}
              className="p-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white block hover:opacity-95 transition-opacity"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} />
                <span className="text-xs font-semibold">{t("sidebar.proUpgrade")}</span>
              </div>
              <p className="text-[11px] text-brand-200 mb-2.5">{t("sidebar.aiCoach")}</p>
              <div className="w-full py-1.5 rounded-lg bg-surface-50/95 text-brand-700 text-xs font-semibold text-center">
                {t("sidebar.upgradePrice")}
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
