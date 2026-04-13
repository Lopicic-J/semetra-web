"use client";
import { clsx } from "clsx";
import { ReactNode } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500 shadow-sm hover:shadow-md",
 secondary:"bg-surface-100 text-surface-700 border border-surface-200/60 hover:bg-surface-200/70 hover:text-surface-800 focus-visible:ring-surface-400",
    danger: "bg-danger-50 text-danger-700 border border-danger-100 hover:bg-danger-100 focus-visible:ring-danger-500 dark:bg-danger-500/15 dark:text-danger-400 dark:border-danger-500/25",
 ghost:"text-surface-500 hover:bg-surface-100 hover:text-surface-700 focus-visible:ring-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
