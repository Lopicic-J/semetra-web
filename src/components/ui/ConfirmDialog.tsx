"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

/* ─── Types ─── */

type Variant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  /** Text on confirm button (default: "Bestätigen") */
  confirmLabel?: string;
  /** Text on cancel button (default: "Abbrechen") */
  cancelLabel?: string;
  /** Visual variant (default: "danger") */
  variant?: Variant;
  /** Show loading spinner on confirm button */
  loading?: boolean;
  /** Custom icon */
  icon?: ReactNode;
}

/* ─── Variant Styles ─── */

const VARIANT_STYLES: Record<Variant, {
  iconBg: string;
  iconColor: string;
  confirmBg: string;
  confirmHover: string;
  defaultIcon: ReactNode;
}> = {
  danger: {
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    confirmBg: "bg-red-600",
    confirmHover: "hover:bg-red-700",
    defaultIcon: <Trash2 className="w-6 h-6" />,
  },
  warning: {
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmBg: "bg-amber-600",
    confirmHover: "hover:bg-amber-700",
    defaultIcon: <AlertTriangle className="w-6 h-6" />,
  },
  info: {
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    confirmBg: "bg-blue-600",
    confirmHover: "hover:bg-blue-700",
    defaultIcon: <AlertTriangle className="w-6 h-6" />,
  },
};

/* ─── Component ─── */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  variant = "danger",
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const style = VARIANT_STYLES[variant];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  // Focus confirm button on open
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  // Click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && !loading) onClose();
    },
    [loading, onClose],
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-sm mx-4 bg-surface-100 rounded-2xl shadow-xl border border-surface-200 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-disabled={loading}
          className="absolute top-3 right-3 p-1 rounded-lg text-surface-400 hover:text-surface-600 transition-colors"
          aria-label="Schliessen"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 sm:p-6">
          {/* Icon */}
          <div className={`mx-auto w-12 h-12 rounded-full ${style.iconBg} ${style.iconColor} flex items-center justify-center mb-4`}>
            {icon ?? style.defaultIcon}
          </div>

          {/* Title */}
          <h3
            id="confirm-title"
            className="text-lg font-semibold text-surface-900 text-center mb-2"
          >
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-surface-500 text-center mb-6">
              {description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              aria-disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={loading}
              aria-disabled={loading}
              aria-busy={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white ${style.confirmBg} ${style.confirmHover} transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hook for easy usage ─── */

import { useState } from "react";

interface UseConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: Variant;
}

/**
 * Hook for confirm dialogs. Returns [ConfirmDialogElement, confirm()].
 *
 * Usage:
 *   const [ConfirmEl, confirmDelete] = useConfirm({
 *     title: "Gruppe löschen?",
 *     description: "Diese Aktion kann nicht rückgängig gemacht werden.",
 *     confirmLabel: "Löschen",
 *   });
 *
 *   // In handler:
 *   const ok = await confirmDelete();
 *   if (ok) { ... }
 *
 *   // In JSX:
 *   return <>{ConfirmEl}<div>...</div></>
 */
export function useConfirm(options: UseConfirmOptions): [ReactNode, () => Promise<boolean>] {
  const [state, setState] = useState<{
    open: boolean;
    loading: boolean;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, loading: false, resolve: null });

  const confirm = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, loading: false, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, loading: false, resolve: null });
  }, [state.resolve]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, loading: false, resolve: null });
  }, [state.resolve]);

  const element = (
    <ConfirmDialog
      open={state.open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      loading={state.loading}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      variant={options.variant}
    />
  );

  return [element, confirm];
}
