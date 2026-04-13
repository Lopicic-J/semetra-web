"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, LogOut, Zap, Gem, ChevronRight, ChevronDown, Bell } from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { useTranslation } from "@/lib/i18n";
import { ProBadge } from "@/components/ui/ProGate";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BOTTOM_ITEMS, getFilteredNavGroups, getAllNavItems } from "./nav-config";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro, loading: profileLoading, userRole } = useProfile();
  const { t } = useTranslation();

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  async function handleLogout() {
    setOpen(false);
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
 <header className="md:hidden flex items-center justify-between px-4 h-14 bg-[rgb(var(--card-bg))] border-b border-surface-200/60 shrink-0 safe-area-top">
        <button
          onClick={() => setOpen(true)}
          className="p-2.5 -ml-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 active:bg-surface-200 dark:active:bg-surface-700 transition-colors"
          aria-label="Menü öffnen"
        >
 <Menu size={22} className="text-surface-600" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Gem size={13} strokeWidth={2.2} />
          </div>
          <span className="font-bold text-surface-900 dark:text-white text-sm tracking-tight">
            {currentPage ? t(currentPage.labelKey) : "Semetra"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          {profileLoading ? (
 <span className="text-[9px] font-bold px-2 py-1 rounded-md bg-surface-100 text-transparent animate-pulse w-8">
              —
            </span>
          ) : (
            <span className={clsx(
              "text-[9px] font-bold px-2 py-1 rounded-md",
              isPro ? "bg-brand-600 text-white" : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
            )}>
              {isPro ? "PRO" : "Free"}
            </span>
          )}
        </div>
      </header>

      {/* Overlay */}
      <div
        className={clsx(
          "md:hidden fixed inset-0 z-50 bg-surface-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out sidebar */}
      <aside
        className={clsx(
          "md:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw]",
"bg-[rgb(var(--card-bg))] shadow-2xl",
          "transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Header */}
 <div className="flex items-center justify-between px-4 py-4 border-b border-surface-100 safe-area-top">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/20">
              <Gem size={17} strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-bold text-surface-900 dark:text-white text-sm leading-tight tracking-tight">Semetra</p>
 <p className="text-[10px] text-surface-400 leading-tight">{t("sidebar.study")}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 active:bg-surface-200 dark:active:bg-surface-700 transition-colors"
            aria-label="Menü schliessen"
          >
            <X size={18} className="text-surface-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-0.5">
          {getFilteredNavGroups(userRole).map((group) => (
            <div key={group.labelKey}>
              {group.labelKey && (
 <p className="px-3 pt-5 pb-2 text-[10px] font-semibold text-surface-400 tracking-wider uppercase select-none">
                  {t(group.labelKey)}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const locked = item.pro && !isPro;
                const isExpanded = expandedItems.has(item.href);
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <div key={item.href}>
                    {hasChildren ? (
                      <button
                        onClick={() => {
                          setExpandedItems(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(item.href)) {
                              newSet.delete(item.href);
                            } else {
                              newSet.add(item.href);
                            }
                            return newSet;
                          });
                        }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 active:scale-[0.98]",
                          active
                            ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                            : locked
 ?"text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
 :"text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 active:bg-surface-200 dark:active:bg-surface-700"
                        )}
                      >
                        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {locked && !active && <ProBadge />}
                        {!locked && (
                          <ChevronDown size={14} className={clsx("transition-transform shrink-0", isExpanded && "rotate-180")} />
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 active:scale-[0.98]",
                          active
                            ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                            : locked
 ?"text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
 :"text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 active:bg-surface-200 dark:active:bg-surface-700"
                        )}
                      >
                        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {locked && !active && <ProBadge />}
                        {active && <ChevronRight size={14} className="opacity-60" />}
                      </Link>
                    )}

                    {/* Expanded children */}
                    {hasChildren && isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {item.children?.map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={clsx(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-150 active:scale-[0.98]",
                                childActive
                                  ? "bg-brand-500 text-white"
 :"text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                              )}
                            >
                              <span className="flex-1 truncate">{t(child.labelKey)}</span>
                              {childActive && <ChevronRight size={12} className="opacity-60" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 active:scale-[0.98]",
                  active
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
 :"text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800"
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
 className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-[13px] font-medium text-surface-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400 transition-all duration-150 active:scale-[0.98]"
          >
            <LogOut size={18} strokeWidth={1.8} className="shrink-0" />
            {t("sidebar.logout")}
          </button>
        </div>

        {/* Upgrade / Pro badge */}
        <div className="px-3 pb-4 safe-area-bottom">
          {isPro ? (
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
              <div className="flex items-center gap-2">
                <Zap size={14} />
                <span className="text-xs font-semibold">{t("sidebar.proActive")}</span>
              </div>
              <p className="text-[11px] text-brand-200 mt-1">{t("sidebar.allFeaturesUnlocked")}</p>
            </div>
          ) : (
            <Link
              href="/upgrade"
              onClick={() => setOpen(false)}
              className="p-3.5 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white block hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} />
                <span className="text-xs font-semibold">{t("sidebar.proUpgrade")}</span>
              </div>
              <p className="text-[11px] text-brand-200 mb-2.5">{t("sidebar.aiCoach")}</p>
              <div className="w-full py-2 rounded-lg bg-surface-50/95 dark:bg-white/95 text-brand-700 text-xs font-semibold text-center">
                {t("sidebar.upgradePrice")}
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
