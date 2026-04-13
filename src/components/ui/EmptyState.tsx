"use client";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4 text-surface-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-surface-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-xs mb-5">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
