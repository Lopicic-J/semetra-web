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
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              {icon}
              {title}
            </h1>
            {subtitle && (
              <p className="text-surface-500 text-sm mt-1">{subtitle}</p>
            )}
          </div>
          {headerActions && <div className="flex gap-2">{headerActions}</div>}
        </div>

        {/* ── Tab bar ──────────────────────────────────── */}
        <div className="flex gap-1 border-b border-surface-200 -mx-6 px-6">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
                  rounded-t-lg transition-colors relative
                  ${
                    isActive
                      ? "text-brand-600 bg-brand-50/50 dark:bg-brand-950/30"
                      : "text-surface-500 hover:text-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800"
                  }
                `}
              >
                {Icon && <Icon size={16} />}
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-600 rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────── */}
      <div className="flex-1 overflow-auto page-tab-content p-4 sm:p-6">{activeContent}</div>
    </div>
  );
}
