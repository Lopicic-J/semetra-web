"use client";
import { clsx } from "clsx";

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
  return (
    <div className={clsx("w-full", className)} {...props}>
      {label && (
        <label className={clsx(
          "block text-sm font-medium mb-1",
          error ? "text-red-700" : "text-gray-700"
        )}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500"></span>
          {error}
        </p>
      )}
    </div>
  );
}
