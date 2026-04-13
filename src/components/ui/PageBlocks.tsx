"use client";

import React, { useMemo } from "react";
import { clsx } from "clsx";
import { useBlockOrder } from "@/lib/hooks/useBlockOrder";
import SortableList from "@/components/ui/SortableList";
import { Eye, EyeOff } from "lucide-react";

export interface BlockDef {
  /** Unique block ID — must be stable across renders */
  id: string;
  /** Human-readable label (shown in edit mode) */
  label?: string;
  /** The actual React content to render */
  content: React.ReactNode;
  /** If true, block is not rendered (but kept in order for later) */
  hidden?: boolean;
}

interface PageBlocksProps {
  /** Ordered array of block definitions (default order) */
  blocks: BlockDef[];
  /** Additional className on the outer wrapper */
  className?: string;
}

/**
 * PageBlocks — renders page sections in a user-customizable order.
 * In editor mode, each block gets a drag handle + visibility toggle.
 * Users can hide/show blocks and reorder via drag & drop.
 */
export default function PageBlocks({ blocks, className }: PageBlocksProps) {
  const defaultOrder = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const { order, reorder, editing, hiddenBlocks, toggleBlock } = useBlockOrder(defaultOrder);

  const blockMap = useMemo(() => {
    const map = new Map<string, BlockDef>();
    blocks.forEach((b) => map.set(b.id, b));
    return map;
  }, [blocks]);

  // Resolve ordered blocks — in edit mode show all (including hidden), otherwise filter
  const orderedBlocks = useMemo(() => {
    return order
      .map((id) => blockMap.get(id))
      .filter((b): b is BlockDef => {
        if (!b) return false;
        if (b.hidden) return false; // Programmatically hidden (e.g. no data)
        if (!editing && hiddenBlocks.has(b.id)) return false; // User-hidden
        return true;
      });
  }, [order, blockMap, editing, hiddenBlocks]);

  return (
    <SortableList
      items={orderedBlocks}
      keyFn={(block) => block.id}
      disabled={!editing}
      className={className}
      onReorder={reorder}
      renderItem={(block, _i, dragHandle) => {
        const isUserHidden = hiddenBlocks.has(block.id);
        return (
          <div
            className={clsx(
              "relative transition-all duration-150",
              editing && "rounded-xl ring-1 ring-dashed ring-amber-300 dark:ring-amber-700 bg-amber-50/20 dark:bg-amber-950/10",
              editing && isUserHidden && "opacity-40",
            )}
          >
            {editing && (
              <div className="absolute -left-1 top-2 z-10 flex items-center gap-1">
                <div className="bg-amber-100 dark:bg-amber-900/60 rounded-lg shadow-sm">
                  {dragHandle}
                </div>
                <button
                  onClick={() => toggleBlock(block.id)}
                  className={clsx(
                    "p-1.5 rounded-lg shadow-sm transition-colors",
                    isUserHidden
                      ? "bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-200"
                      : "bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-400 hover:bg-green-200"
                  )}
                  title={isUserHidden ? "Widget einblenden" : "Widget ausblenden"}
                >
                  {isUserHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {block.label && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded shadow-sm">
                    {block.label}
                  </span>
                )}
              </div>
            )}
            <div className={clsx(editing && "pl-6")}>
              {!isUserHidden && block.content}
              {isUserHidden && editing && (
                <div className="py-6 text-center text-sm text-surface-400">
                  <EyeOff size={20} className="mx-auto mb-1" />
                  {block.label ?? block.id} — ausgeblendet
                </div>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
