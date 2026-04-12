"use client";
import { clsx } from "clsx";
import { useId, cloneElement } from "react";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({
  label,
  error,
  required = false,
  className,
  children,
  ...props
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={clsx("w-full", className)} {...props}>
      {label && (
        <label htmlFor={id} className={clsx(
          "block text-sm font-medium mb-1",
          error ? "text-red-700 dark:text-red-400" : "text-gray-700 dark:text-surface-300"
        )}>
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="erforderlich">*</span>}
        </label>
      )}
      <div className="relative">
        {children && typeof children === 'object' && 'props' in children
          ? cloneElement(children as React.ReactElement, {
              id: (children as React.ReactElement).props.id || id,
              'aria-describedby': error ? errorId : undefined,
              'aria-required': required || undefined,
            })
          : children}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500"></span>
          {error}
        </p>
      )}
    </div>
  );
}
