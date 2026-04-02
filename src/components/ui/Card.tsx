"use client";
import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Card({
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  const paddingStyles = {
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={clsx(
        "bg-white rounded-2xl shadow-card border border-gray-100 dark:bg-gray-900 dark:border-gray-800",
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
