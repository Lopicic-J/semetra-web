"use client";

import React, { useState, useRef, useCallback } from "react";
import { clsx } from "clsx";
import { GripVertical } from "lucide-react";

interface SortableListProps<T> {
  items: T[];
  keyFn: (item: T) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, index: number, dragHandle: React.ReactNode) => React.ReactNode;
  className?: string;
  direction?: "vertical" | "horizontal";
  disabled?: boolean;
}

/**
 * Generic sortable list using native HTML5 Drag & Drop.
 * Pass `disabled` to turn off DnD (e.g. when editor mode is off).
 *
 * Uses midpoint detection: dropping on the top half of an item places
 * the dragged item above it; dropping on the bottom half places it below.
 * This makes it easy to move items both up and down.
 */
export default function SortableList<T>({
  items,
  keyFn,
  onReorder,
  renderItem,
  className,
  direction = "vertical",
  disabled = false,
}: SortableListProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // "before" = cursor is in top/left half, "after" = bottom/right half
  const [dropPosition, setDropPosition] = useState<"before" | "after">("after");
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (disabled) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      setDragIndex(index);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Calculate midpoint to determine before/after position
      const el = itemRefs.current.get(index);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (direction === "horizontal") {
          const midX = rect.left + rect.width / 2;
          setDropPosition(e.clientX < midX ? "before" : "after");
        } else {
          const midY = rect.top + rect.height / 2;
          setDropPosition(e.clientY < midY ? "before" : "after");
        }
      }

      setOverIndex(index);
    },
    [disabled, direction],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, rawToIndex: number) => {
      if (disabled) return;
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData("text/plain"));
      if (isNaN(fromIndex)) return;

      // Compute the actual target index based on drop position
      let toIndex = rawToIndex;
      if (dropPosition === "after") {
        toIndex = rawToIndex + 1;
      }
      // Adjust if dragging downward (splice removes the item first)
      if (fromIndex < toIndex) {
        toIndex -= 1;
      }

      if (fromIndex !== toIndex && toIndex >= 0 && toIndex < items.length) {
        onReorder(fromIndex, toIndex);
      }

      setDragIndex(null);
      setOverIndex(null);
    },
    [disabled, onReorder, dropPosition, items.length],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  return (
    <div
      className={clsx(
        direction === "horizontal" ? "flex items-center gap-1" : "space-y-0.5",
        className,
      )}
    >
      {items.map((item, index) => {
        const key = keyFn(item);
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== index;

        const dragHandle = disabled ? null : (
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-surface-400 hover:text-surface-600 transition-colors touch-none"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
          >
            <GripVertical size={14} />
          </div>
        );

        return (
          <div
            key={key}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={clsx(
              "transition-all duration-150 relative",
              isDragging && "opacity-40",
              isOver && direction === "horizontal" && dropPosition === "before" && "border-l-2 border-brand-500 pl-1",
              isOver && direction === "horizontal" && dropPosition === "after" && "border-r-2 border-brand-500 pr-1",
              isOver && direction === "vertical" && dropPosition === "before" && "border-t-2 border-brand-500 pt-1",
              isOver && direction === "vertical" && dropPosition === "after" && "border-b-2 border-brand-500 pb-1",
            )}
          >
            {renderItem(item, index, dragHandle)}
          </div>
        );
      })}
    </div>
  );
}
