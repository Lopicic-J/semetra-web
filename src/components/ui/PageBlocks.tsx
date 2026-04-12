"use client";

import React, { useMemo } from "react";
import { clsx } from "clsx";
import { useBlockOrder } from "@/lib/hooks/useBlockOrder";
import SortableList from "@/components/ui/SortableList";

export interface BlockDef {
  /** Unique block ID — must be stable across renders */
  id: string;
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
 * In editor mode, each block gets a drag handle for reordering.
 * Blocks maintain their original styling/spacing.
 */
export default function PageBlocks({ blocks, className }: PageBlocksProps) {
  const defaultOrder = useMemo(() => blocks.map((b) => b.id), [blocks]);
  const { order, reorder, editing } = useBlockOrder(defaultOrder);

  const blockMap = useMemo(() => {
    const map = new Map<string, BlockDef>();
    blocks.forEach((b) => map.set(b.id, b));
    return map;
  }, [blocks]);

  // Resolve ordered blocks
  const orderedBlocks = useMemo(() => {
    return order
      .map((id) => blockMap.get(id))
      .filter((b): b is BlockDef => !!b && !b.hidden);
  }, [order, blockMap]);

  return (
    <SortableList
      items={orderedBlocks}
      keyFn={(block) => block.id}
      disabled={!editing}
      className={className}
      onReorder={reorder}
      renderItem={(block, _i, dragHandle) => (
        <div
          className={clsx(
            "relative transition-all duration-150",
            editing && "rounded-xl ring-1 ring-dashed ring-amber-300 dark:ring-amber-700 bg-amber-50/20 dark:bg-amber-950/10",
          )}
        >
          {editing && (
            <div className="absolute -left-1 top-2 z-10 bg-amber-100 dark:bg-amber-900/60 rounded-lg shadow-sm">
              {dragHandle}
            </div>
          )}
          <div className={clsx(editing && "pl-6")}>
            {block.content}
          </div>
        </div>
      )}
    />
  );
}
