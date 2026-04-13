"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
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
 * Generic sortable list with HTML5 Drag & Drop + Touch fallback.
 * Pass `disabled` to turn off DnD (e.g. when editor mode is off).
 *
 * Uses midpoint detection: dropping on the top half of an item places
 * the dragged item above it; dropping on the bottom half places it below.
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
  const [dropPosition, setDropPosition] = useState<"before" | "after">("after");
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Touch DnD state ──────────────────────────────────────────────
  const touchState = useRef<{
    active: boolean;
    startIndex: number;
    startY: number;
    startX: number;
    clone: HTMLDivElement | null;
    scrollInterval: ReturnType<typeof setInterval> | null;
  }>({ active: false, startIndex: -1, startY: 0, startX: 0, clone: null, scrollInterval: null });

  // Cleanup clone on unmount
  useEffect(() => {
    return () => {
      if (touchState.current.clone) {
        touchState.current.clone.remove();
      }
      if (touchState.current.scrollInterval) {
        clearInterval(touchState.current.scrollInterval);
      }
    };
  }, []);

  // ── HTML5 Drag handlers ──────────────────────────────────────────
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

      const el = itemRefs.current.get(index);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (direction === "horizontal") {
          setDropPosition(e.clientX < rect.left + rect.width / 2 ? "before" : "after");
        } else {
          setDropPosition(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
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

      let toIndex = rawToIndex;
      if (dropPosition === "after") toIndex = rawToIndex + 1;
      if (fromIndex < toIndex) toIndex -= 1;

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

  // ── Touch handlers ───────────────────────────────────────────────
  const findTouchOverIndex = useCallback(
    (clientX: number, clientY: number): { index: number; position: "before" | "after" } | null => {
      for (const [idx, el] of itemRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          if (direction === "horizontal") {
            return { index: idx, position: clientX < rect.left + rect.width / 2 ? "before" : "after" };
          }
          return { index: idx, position: clientY < rect.top + rect.height / 2 ? "before" : "after" };
        }
      }
      return null;
    },
    [direction],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      if (disabled) return;
      const touch = e.touches[0];
      touchState.current = {
        active: false,
        startIndex: index,
        startY: touch.clientY,
        startX: touch.clientX,
        clone: null,
        scrollInterval: null,
      };
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const ts = touchState.current;
      const touch = e.touches[0];
      const dx = touch.clientX - ts.startX;
      const dy = touch.clientY - ts.startY;

      // Activate drag after 8px movement
      if (!ts.active && Math.sqrt(dx * dx + dy * dy) > 8) {
        ts.active = true;
        setDragIndex(ts.startIndex);

        // Create floating clone
        const el = itemRefs.current.get(ts.startIndex);
        if (el) {
          const rect = el.getBoundingClientRect();
          const clone = document.createElement("div");
          clone.innerHTML = el.innerHTML;
          clone.style.cssText = `
            position: fixed; top: ${rect.top}px; left: ${rect.left}px;
            width: ${rect.width}px; height: ${rect.height}px;
            opacity: 0.85; pointer-events: none; z-index: 9999;
            background: var(--card-bg, #fff); border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            transition: none;
          `;
          document.body.appendChild(clone);
          ts.clone = clone;
        }
      }

      if (!ts.active) return;

      // Prevent scroll while dragging
      e.preventDefault();

      // Move clone
      if (ts.clone) {
        const el = itemRefs.current.get(ts.startIndex);
        if (el) {
          const rect = el.getBoundingClientRect();
          ts.clone.style.top = `${rect.top + dy}px`;
          ts.clone.style.left = `${rect.left + dx}px`;
        }
      }

      // Find target
      const hit = findTouchOverIndex(touch.clientX, touch.clientY);
      if (hit) {
        setOverIndex(hit.index);
        setDropPosition(hit.position);
      }
    },
    [disabled, findTouchOverIndex],
  );

  const handleTouchEnd = useCallback(() => {
    const ts = touchState.current;

    // Cleanup clone
    if (ts.clone) {
      ts.clone.remove();
      ts.clone = null;
    }
    if (ts.scrollInterval) {
      clearInterval(ts.scrollInterval);
      ts.scrollInterval = null;
    }

    if (!ts.active || dragIndex === null || overIndex === null) {
      setDragIndex(null);
      setOverIndex(null);
      ts.active = false;
      return;
    }

    const fromIndex = ts.startIndex;
    let toIndex = overIndex;
    if (dropPosition === "after") toIndex = overIndex + 1;
    if (fromIndex < toIndex) toIndex -= 1;

    if (fromIndex !== toIndex && toIndex >= 0 && toIndex < items.length) {
      onReorder(fromIndex, toIndex);
    }

    setDragIndex(null);
    setOverIndex(null);
    ts.active = false;
  }, [dragIndex, overIndex, dropPosition, items.length, onReorder]);

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
            className="cursor-grab active:cursor-grabbing p-1 text-surface-400 hover:text-surface-600 transition-colors touch-none select-none"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onTouchMove={(e) => handleTouchMove(e)}
            onTouchEnd={handleTouchEnd}
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
