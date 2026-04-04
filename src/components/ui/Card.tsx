"use client";
import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
  children: React.ReactNode;
}

export function Card({
  padding = "md",
  interactive = false,
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
        "bg-[rgb(var(--card-bg))] rounded-2xl shadow-card border border-surface-200/60 transition-all duration-200",
        interactive && "hover:shadow-card-md hover:border-surface-200 cursor-pointer active:scale-[0.995]",
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
