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
  const dragCounter = useRef(0);

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
      setOverIndex(index);
    },
    [disabled],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragCounter.current++;
    },
    [disabled],
  );

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      if (disabled) return;
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData("text/plain"));
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        onReorder(fromIndex, toIndex);
      }
      setDragIndex(null);
      setOverIndex(null);
      dragCounter.current = 0;
    },
    [disabled, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragCounter.current = 0;
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
            className="cursor-grab active:cursor-grabbing p-0.5 text-surface-400 hover:text-surface-600 transition-colors"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
          >
            <GripVertical size={14} />
          </div>
        );

        return (
          <div
            key={key}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={clsx(
              "transition-all duration-150",
              isDragging && "opacity-40",
              isOver && (direction === "horizontal"
                ? "border-l-2 border-brand-500 pl-1"
                : "border-t-2 border-brand-500 pt-1"),
            )}
          >
            {renderItem(item, index, dragHandle)}
          </div>
        );
      })}
    </div>
  );
}
