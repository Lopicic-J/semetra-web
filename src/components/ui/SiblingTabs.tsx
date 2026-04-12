"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslation } from "@/lib/i18n";
import { NAV_GROUPS } from "@/components/sidebar/nav-config";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";
import SortableList from "@/components/ui/SortableList";

/**
 * SiblingTabs — renders horizontal tabs for all children of the current
 * sidebar hub. Supports reordering via drag & drop when editor mode is active.
 */
export default function SiblingTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { editing, getOrderedChildren, reorderChildren } = useLayoutEditor();

  // Find the parent item whose children include the current pathname
  const parent = NAV_GROUPS
    .flatMap((g) => g.items)
    .find((item) =>
      item.children?.some(
        (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
      ),
    );

  // If no parent found or only one child, don't render tabs
  if (!parent?.children || parent.children.length <= 1) return null;

  const orderedChildren = getOrderedChildren(parent.labelKey, parent.children);

  return (
    <div className={clsx(
      "flex items-center gap-1 px-1 py-1 mx-4 mt-4 mb-0 md:mx-6 md:mt-5 rounded-xl border overflow-x-auto scrollbar-none",
      editing
        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
        : "bg-surface-50 dark:bg-surface-800/50 border-surface-100 dark:border-surface-800",
    )}>
      <SortableList
        items={orderedChildren}
        keyFn={(child) => child.href}
        disabled={!editing}
        direction="horizontal"
        onReorder={(from, to) => reorderChildren(parent.labelKey, from, to)}
        renderItem={(child, _i, dragHandle) => {
          const isActive =
            pathname === child.href || pathname.startsWith(child.href + "/");

          return (
            <div className="flex items-center gap-0.5">
              {editing && dragHandle}
              <Link
                href={child.href}
                className={clsx(
                  "px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap",
                  isActive
                    ? "bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/50",
                )}
              >
                {t(child.labelKey)}
              </Link>
            </div>
          );
        }}
      />
    </div>
  );
}
