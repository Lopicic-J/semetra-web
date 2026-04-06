"use client";

import { Shield, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import type { ModuleRisk, RiskLevel, ModuleIntelligence } from "@/lib/decision/types";
import Link from "next/link";

interface RiskOverviewProps {
  risks: {
    critical: ModuleRisk[];
    high: ModuleRisk[];
    medium: ModuleRisk[];
  };
  modules: ModuleIntelligence[];
}

const riskColors: Record<RiskLevel, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
  none: "bg-green-500",
};

const riskTextColors: Record<RiskLevel, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
  none: "text-green-600 dark:text-green-400",
};

export default function RiskOverview({ risks, modules }: RiskOverviewProps) {
  const totalAtRisk = risks.critical.length + risks.high.length + risks.medium.length;
  const allRisks = [...risks.critical, ...risks.high, ...risks.medium];

  return (
    <div className="bg-surface-100/50 rounded-xl border border-surface-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-surface-600" />
          <h3 className="font-semibold text-surface-900">Risiko-Monitor</h3>
        </div>
        {totalAtRisk > 0 ? (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            {totalAtRisk} Module betroffen
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            Alles im grünen Bereich
          </span>
        )}
      </div>

      {/* Risk Distribution Bar */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-surface-200 mb-4">
        {risks.critical.length > 0 && (
          <div
            className="bg-red-500 rounded-full"
            style={{ flex: risks.critical.length }}
          />
        )}
        {risks.high.length > 0 && (
          <div
            className="bg-orange-500 rounded-full"
            style={{ flex: risks.high.length }}
          />
        )}
        {risks.medium.length > 0 && (
          <div
            className="bg-yellow-500 rounded-full"
            style={{ flex: risks.medium.length }}
          />
        )}
        {totalAtRisk === 0 && <div className="bg-green-500 rounded-full flex-1" />}
      </div>

      {/* Risk Items */}
      <div className="space-y-2.5">
        {allRisks.slice(0, 5).map((risk) => {
          const mod = modules.find((m) => m.moduleId === risk.moduleId);
          if (!mod) return null;
          const topFactor = risk.factors[0];
          return (
            <Link
              key={risk.moduleId}
              href={`/modules/${risk.moduleId}`}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-200/50 transition-colors group"
            >
              <div
                className="w-2 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: mod.color ?? "#6b7280" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600">
                  {mod.moduleName}
                </p>
                {topFactor && (
                  <p className="text-xs text-surface-500 truncate">{topFactor.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-semibold ${riskTextColors[risk.overall]}`}>
                  {risk.score}
                </span>
                <div className={`w-2 h-2 rounded-full ${riskColors[risk.overall]}`} />
              </div>
            </Link>
          );
        })}
        {totalAtRisk === 0 && (
          <div className="flex items-center gap-2 py-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Keine Module mit erhöhtem Risiko</span>
          </div>
        )}
      </div>
    </div>
  );
}
