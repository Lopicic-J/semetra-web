"use client";

import { AlertTriangle, AlertCircle, Info, XCircle } from "lucide-react";
import type { Alert, RiskLevel } from "@/lib/decision/types";
import Link from "next/link";

interface AlertBannerProps {
  alerts: Alert[];
}

const alertStyles: Record<RiskLevel, { bg: string; border: string; icon: typeof AlertCircle; iconColor: string }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", icon: XCircle, iconColor: "text-red-600 dark:text-red-400" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", icon: AlertTriangle, iconColor: "text-orange-600 dark:text-orange-400" },
  medium: { bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800", icon: AlertCircle, iconColor: "text-yellow-600 dark:text-yellow-400" },
  low: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", icon: Info, iconColor: "text-blue-600 dark:text-blue-400" },
  none: { bg: "bg-surface-100/50", border: "border-surface-200", icon: Info, iconColor: "text-surface-500" },
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  // Show top 3 alerts
  const topAlerts = alerts.slice(0, 3);

  return (
    <div className="space-y-2">
      {topAlerts.map((alert, i) => {
        const style = alertStyles[alert.level];
        const Icon = style.icon;
        return (
          <div
            key={`alert-${i}`}
            className={`${style.bg} ${style.border} border rounded-lg px-4 py-3 flex items-start gap-3`}
          >
            <Icon className={`${style.iconColor} w-5 h-5 mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-surface-900">{alert.title}</p>
              <p className="text-xs text-surface-600 mt-0.5">{alert.message}</p>
            </div>
            {alert.moduleId && (
              <Link
                href={`/modules/${alert.moduleId}`}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex-shrink-0"
              >
                Anzeigen
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
