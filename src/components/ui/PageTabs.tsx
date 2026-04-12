"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

/* ─────────────────────────────────────────────────────────── */
/*  PageTabs — reusable top-level tab component for merged    */
/*  pages.  Persists the active tab in ?tab= query param so   */
/*  users can share / bookmark specific tabs.                 */
/* ─────────────────────────────────────────────────────────── */

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
}

interface PageTabsProps {
  /** Page title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Icon shown next to title */
  icon?: ReactNode;
  /** Tab definitions */
  tabs: TabDef[];
  /** Default active tab id (defaults to first tab) */
  defaultTab?: string;
  /** Optional right-side header actions */
  headerActions?: ReactNode;
}

export function PageTabs({
  title,
  subtitle,
  icon,
  tabs,
  defaultTab,
  headerActions,
}: PageTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const paramTab = searchParams.get("tab");
  const resolvedDefault = defaultTab || tabs[0]?.id || "";
  const validTab = tabs.find((t) => t.id === paramTab)?.id ?? resolvedDefault;

  const [activeTab, setActiveTab] = useState(validTab);

  // Sync with URL param changes
  useEffect(() => {
    const p = searchParams.get("tab");
    const valid = tabs.find((t) => t.id === p)?.id ?? resolvedDefault;
    setActiveTab(valid);
  }, [searchParams, tabs, resolvedDefault]);

  const switchTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === resolvedDefault) {
        params.delete("tab");
      } else {
        params.set("tab", tabId);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, resolvedDefault, router, searchParams],
  );

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ───────────────────────────────────── */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-0">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              {icon}
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && (
              <p className="text-surface-500 dark:text-surface-400 text-xs sm:text-sm mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {headerActions && <div className="flex gap-2 shrink-0">{headerActions}</div>}
        </div>

        {/* ── Tab bar ──────────────────────────────────── */}
        <div className="flex gap-0.5 border-b border-surface-200 dark:border-surface-700 -mx-3 sm:-mx-6 px-3 sm:px-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`
                  flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium
                  rounded-t-lg transition-colors relative whitespace-nowrap shrink-0
                  ${
                    isActive
                      ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/30"
                      : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800"
                  }
                `}
              >
                {Icon && <Icon size={15} />}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.length > 10 ? tab.label.split(/[\s/]/)[0] : tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────── */}
      <div className="flex-1 overflow-auto page-tab-content">{activeContent}</div>
    </div>
  );
}
