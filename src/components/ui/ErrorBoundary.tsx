"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

const log = logger("ui:error-boundary");

/* ─── Types ─── */

interface Props {
  children: ReactNode;
  /** Optional fallback UI — receives error + reset function */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Feature name for context in error display (e.g., "Lernplan", "Gruppen") */
  feature?: string;
  /** Called when an error is caught — use for logging/Sentry */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/* ─── Component ─── */

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error(`ErrorBoundary${this.props.feature ? `: ${this.props.feature}` : ""}`, {
      error: error.toString(),
      componentStack: info.componentStack,
    });

    // Capture error in Sentry if available
    if (typeof window !== "undefined" && (window as any).__SENTRY__?.captureException) {
      (window as any).__SENTRY__.captureException(error, {
        contexts: {
          component: {
            feature: this.props.feature,
            componentStack: info.componentStack,
          },
        },
      });
    }

    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      // Default fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {this.props.feature
              ? `Fehler in ${this.props.feature}`
              : "Etwas ist schiefgelaufen"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-5">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4 max-w-md overflow-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Erneut versuchen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ─── Inline Error Fallback (for smaller sections) ─── */

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">
        {message ?? "Fehler beim Laden der Daten"}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium flex-shrink-0"
        >
          Wiederholen
        </button>
      )}
    </div>
  );
}
