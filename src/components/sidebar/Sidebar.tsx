"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Zap, Gem, Flame, Pin, PinOff, ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "@/lib/hooks/useProfile";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { useTranslation } from "@/lib/i18n";
import { ProBadge } from "@/components/ui/ProGate";
import { BOTTOM_ITEMS, getFilteredNavGroups, type NavItem as NavItemType } from "./nav-config";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";
import SortableList from "@/components/ui/SortableList";

// ── Pin persistence (localStorage — syncs to Supabase later) ────────────────

const PIN_STORAGE_KEY = "semetra_pinned_tabs";

function loadPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePins(pins: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins));
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro, userRole } = useProfile();
  const streak = useStreaks();
  const { t } = useTranslation();
  const [pins, setPins] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { editing, getOrderedGroups, getOrderedChildren, reorderItems, reorderChildren } = useLayoutEditor();

  // Load pins on mount
  useEffect(() => {
    setPins(loadPins());
  }, []);

  const togglePin = useCallback((href: string) => {
    setPins((prev) => {
      const next = prev.includes(href)
        ? prev.filter((p) => p !== href)
        : [...prev, href];
      savePins(next);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Auto-expand the active parent (also checks children hrefs for cross-page links)
  useEffect(() => {
    const groups = getFilteredNavGroups(userRole);
    for (const g of groups) {
      for (const item of g.items) {
        if (!item.children) continue;
        const directMatch = pathname === item.href || pathname.startsWith(item.href);
        const childMatch = item.children.some(c => {
          const childPath = c.href.split("?")[0];
          return pathname === childPath || pathname.startsWith(childPath);
        });
        if (directMatch || childMatch) {
          setExpandedItems((prev) => new Set([...prev, item.href]));
        }
      }
    }
  }, [pathname, userRole]);

  // ── Pinned items section ──────────────────────────────────────────────────

  const defaultGroups = getFilteredNavGroups(userRole);
  const orderedGroups = getOrderedGroups();
  // Use ordered groups but filter by role
  const allGroups = orderedGroups.length > 0
    ? orderedGroups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (item) => !item.requiredRoles || item.requiredRoles.includes(userRole),
          ),
        }))
        .filter((g) => !g.requiredRoles || g.requiredRoles.includes(userRole))
        .filter((g) => g.items.length > 0)
    : defaultGroups;
  const allItems = allGroups.flatMap((g) => g.items);
  const allChildren = allItems.flatMap((item) =>
    (item.children ?? []).map((child) => ({
      ...child,
      parentIcon: item.icon,
      parentLabel: t(item.labelKey),
    }))
  );

  const pinnedChildren = allChildren.filter((c) => pins.includes(c.href));

  // ── Render helpers ────────────────────────────────────────────────────────

  function NavItem({ href, icon: Icon, labelKey, pro, children }: NavItemType) {
    const directActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    // Also active if any child path matches (for cross-page children like /studium tabs under /exams)
    const childActive = children?.some(c => {
      const childPath = c.href.split("?")[0];
      return pathname === childPath || pathname.startsWith(childPath + "/");
    }) ?? false;
    const active = directActive || childActive;
    const locked = pro && !isPro;
    const hasChildren = children && children.length > 0;
    const isExpanded = expandedItems.has(href);

    return (
      <div>
        <div className="flex items-center">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(href)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 flex-1 min-w-0 text-left",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : locked
                    ? "text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
                    : "text-surface-500 hover:bg-surface-100 hover:text-surface-800 dark:hover:bg-surface-800"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              <span className="flex-1 truncate">{t(labelKey)}</span>
              {locked && !active && <ProBadge />}
              {isExpanded
                ? <ChevronDown size={12} className="shrink-0 ml-auto" />
                : <ChevronRight size={12} className="shrink-0 ml-auto" />}
            </button>
          ) : (
            <Link
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 flex-1 min-w-0",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : locked
                    ? "text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
                    : "text-surface-500 hover:bg-surface-100 hover:text-surface-800 dark:hover:bg-surface-800"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              <span className="flex-1 truncate">{t(labelKey)}</span>
              {locked && !active && <ProBadge />}
            </Link>
          )}
        </div>

        {/* Sub-items (expandable) */}
        {hasChildren && isExpanded && (
          <div className="ml-4 mt-0.5">
            <SortableList
              items={getOrderedChildren(labelKey, children)}
              keyFn={(child) => child.href}
              disabled={!editing}
              onReorder={(from, to) => reorderChildren(labelKey, from, to)}
              renderItem={(child, _i, dragHandle) => {
                const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
                const isPinned = pins.includes(child.href);

                return (
                  <div className="flex items-center group">
                    {editing && dragHandle}
                    <Link
                      href={child.href}
                      className={clsx(
                        "flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all truncate",
                        isChildActive
                          ? "text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-950/30"
                          : "text-surface-400 hover:text-surface-600 hover:bg-surface-50 dark:hover:text-surface-300 dark:hover:bg-surface-800"
                      )}
                    >
                      {t(child.labelKey)}
                    </Link>
                    {!editing && (
                      <button
                        onClick={() => togglePin(child.href)}
                        className={clsx(
                          "p-1 rounded transition-all shrink-0",
                          isPinned
                            ? "text-brand-500 opacity-100"
                            : "text-surface-300 opacity-0 group-hover:opacity-100 hover:text-brand-400"
                        )}
                        title={isPinned ? "Lösen" : "Anpinnen"}
                      >
                        {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                      </button>
                    )}
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex flex-col w-[232px] shrink-0 h-screen bg-[rgb(var(--card-bg))] border-r border-surface-200/60 px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white shrink-0">
          <Gem size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-surface-900 text-sm leading-tight tracking-tight">Semetra</p>
          <p className="text-[10px] text-surface-400 leading-tight">Study Organizer</p>
        </div>
        <span className={clsx(
          "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0",
          isPro ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"
        )}>
          {isPro ? "PRO" : "Free"}
        </span>
      </div>

      {/* Pinned Quick Access */}
      {pinnedChildren.length > 0 && (
        <div className="mb-3">
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-surface-400 tracking-wider uppercase select-none flex items-center gap-1">
            <Pin size={9} />
            Favoriten
          </p>
          <div className="space-y-0.5">
            {pinnedChildren.map((child) => {
              const ParentIcon = child.parentIcon;
              return (
                <div key={child.href} className="flex items-center group">
                  <Link
                    href={child.href}
                    className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-xl text-[12px] font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-all truncate dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-300"
                  >
                    <ParentIcon size={13} strokeWidth={1.6} className="shrink-0 text-surface-400" />
                    <span className="truncate">{t(child.labelKey)}</span>
                  </Link>
                  <button
                    onClick={() => togglePin(child.href)}
                    className="p-1 rounded text-surface-300 opacity-0 group-hover:opacity-100 hover:text-danger-500 transition-all shrink-0"
                    title="Lösen"
                  >
                    <PinOff size={11} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="border-t border-surface-100 mx-3 mt-2" />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-0.5 -mr-0.5">
        {allGroups.map((group, idx) => (
          <div key={group.labelKey || `g-${idx}`}>
            {idx > 0 && group.labelKey && (
              <div className="border-t border-surface-100 mx-3 my-1" />
            )}
            {group.labelKey && (
              <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold text-surface-400 tracking-wider uppercase select-none">
                {t(group.labelKey)}
              </p>
            )}
            <SortableList
              items={group.items}
              keyFn={(item) => item.labelKey}
              disabled={!editing}
              onReorder={(from, to) => reorderItems(group.labelKey, from, to)}
              renderItem={(item, _i, dragHandle) => (
                <div className="flex items-center">
                  {editing && dragHandle}
                  <div className="flex-1 min-w-0">
                    <NavItem {...item} />
                  </div>
                </div>
              )}
            />
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-2 pt-3 border-t border-surface-100 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-surface-500 hover:bg-surface-100 hover:text-surface-800 dark:hover:bg-surface-800"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              <span className="flex-1 truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-surface-400 hover:bg-danger-50 hover:text-danger-600 transition-all duration-150"
        >
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
          <div className="w-full py-1.5 rounded-lg bg-surface-50/95 text-brand-700 text-xs font-semibold text-center hover:bg-surface-50 transition-colors dark:bg-surface-800/95 dark:text-brand-400">
            {t("sidebar.upgradePrice")}
          </div>
        </Link>
      )}
    </aside>
  );
}
