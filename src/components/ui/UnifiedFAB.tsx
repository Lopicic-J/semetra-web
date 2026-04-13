"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MessageCircle, Pencil, Sparkles, X, RotateCcw, Menu } from "lucide-react";
import { clsx } from "clsx";
import { useLayoutEditor } from "@/lib/hooks/useLayoutEditor";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";

interface Props {
  /** Unread chat message count (from ChatBubble) */
  unreadCount?: number;
  /** Whether chat panel is open */
  chatOpen?: boolean;
  /** Toggle chat panel */
  onToggleChat?: () => void;
}

/**
 * Unified draggable FAB that combines:
 *  - Chat/Messages toggle (with unread badge)
 *  - Layout Editor toggle
 *  - KI Assistant shortcut
 */
export default function UnifiedFAB({ unreadCount = 0, chatOpen = false, onToggleChat }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { editing, toggleEditing, resetLayout } = useLayoutEditor();

  const [expanded, setExpanded] = useState(false);

  // ─── Drag state ──────────────────────────────────────────────────
  const fabRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 24, y: 24 }); // offset from bottom-right
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = dragStart.current.x - e.clientX;
    const dy = dragStart.current.y - e.clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true;
    if (!hasMoved.current) return;

    const newX = Math.max(8, Math.min(window.innerWidth - 72, dragStart.current.posX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 72, dragStart.current.posY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  const handleFabClick = () => {
    if (hasMoved.current) return; // was a drag, not a click
    if (editing) {
      toggleEditing(); // exit editor mode
      return;
    }
    setExpanded(prev => !prev);
  };

  const handleChat = () => {
    setExpanded(false);
    onToggleChat?.();
  };

  const handleEditor = () => {
    setExpanded(false);
    toggleEditing();
  };

  const handleAI = () => {
    setExpanded(false);
    router.push("/ki");
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div
      ref={fabRef}
      className="fixed z-50 select-none"
      style={{ right: pos.x, bottom: pos.y }}
    >
      {/* ── Editor-mode reset button ── */}
      {editing && (
        <button
          onClick={resetLayout}
 className="absolute -top-12 right-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 text-surface-600 rounded-xl shadow-lg border border-surface-200 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all text-[11px] font-medium whitespace-nowrap"
        >
          <RotateCcw size={12} />
          {t("layout.reset") || "Zurücksetzen"}
        </button>
      )}

      {/* ── Expanded menu ── */}
      {expanded && !editing && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* KI Assistant */}
          <button
            onClick={handleAI}
            className="flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-2xl bg-white dark:bg-surface-800 shadow-lg border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-xl transition-all group"
          >
 <span className="text-sm font-medium text-surface-700 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {t("fab.aiAssistant") || "KI-Assistent"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={18} />
            </div>
          </button>

          {/* Layout Editor */}
          <button
            onClick={handleEditor}
            className="flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-2xl bg-white dark:bg-surface-800 shadow-lg border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-xl transition-all group"
          >
 <span className="text-sm font-medium text-surface-700 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {t("fab.layoutEditor") || "Layout anpassen"}
            </span>
 <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 shadow-sm">
              <Pencil size={18} />
            </div>
          </button>

          {/* Messages / Chat */}
          <button
            onClick={handleChat}
            className="flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-2xl bg-white dark:bg-surface-800 shadow-lg border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-xl transition-all group"
          >
 <span className="text-sm font-medium text-surface-700 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {t("fab.messages") || "Nachrichten"}
            </span>
 <div className="relative w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 shadow-sm">
              <MessageCircle size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* ── Main FAB button ── */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleFabClick}
        className={clsx(
          "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 touch-none",
          editing
            ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30"
            : chatOpen
 ?"bg-surface-700 text-white shadow-surface-700/30"
              : expanded
 ?"bg-surface-800 text-white shadow-surface-800/30 rotate-45"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30",
        )}
        title={editing ? (t("layout.done") || "Fertig") : (t("fab.toggle") || "Menü")}
      >
        {editing ? (
          <X size={22} />
        ) : chatOpen ? (
          <X size={22} />
        ) : expanded ? (
          <X size={22} />
        ) : (
          <div className="relative">
            <Menu size={22} />
            {unreadCount > 0 && !expanded && (
              <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-brand-600">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
