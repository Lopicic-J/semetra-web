"use client";
import { clsx } from "clsx";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function LoadingSpinner({ size = "md", label = "Laden..." }: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <div
        className={clsx(
          sizeStyles[size],
          "animate-spin rounded-full border-2 border-gray-200 border-t-violet-600 dark:border-gray-700 dark:border-t-violet-500"
        )}
        role="status"
        aria-label={label}
        aria-live="polite"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
