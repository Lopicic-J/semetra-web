"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { TrendingUp, Zap } from "lucide-react";
import { logger } from "@/lib/logger";

const log = logger("ui:usage");

interface DailyUsage {
  date: string;
  count: number;
}

interface KeyUsage {
  key_id: string;
  key_prefix: string;
  name: string;
  count: number;
}

interface UsageData {
  daily: DailyUsage[];
  total: number;
  byKey: KeyUsage[];
}

export function UsageDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/developer/usage");
        const json = await res.json();
        if (json.daily) {
          setData(json);
        }
      } catch (err) {
        log.error("load failed", err);
        toast.error(t("developer.usage.loadError") || "Fehler beim Laden der Nutzungsdaten");
      }
      setLoading(false);
    }
    load();
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-surface-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-4 sm:p-6 text-center text-surface-500">
        <p>{t("developer.usage.loadError") || "Fehler beim Laden"}</p>
      </div>
    );
  }

  // Calculate stats
  const today = new Date().toISOString().split("T")[0];
  const todayCount = data.daily.find(d => d.date === today)?.count ?? 0;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekCount = data.daily
    .filter(d => new Date(d.date) >= oneWeekAgo)
    .reduce((sum, d) => sum + d.count, 0);

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const monthCount = data.daily
    .filter(d => new Date(d.date) >= oneMonthAgo)
    .reduce((sum, d) => sum + d.count, 0);

  // Find max for chart scaling
  const maxDaily = Math.max(...data.daily.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-2">{t("developer.usage.today")}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-surface-900">{todayCount}</span>
            <span className="text-xs text-surface-400">Anfragen</span>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-2">{t("developer.usage.week")}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-surface-900">{weekCount}</span>
            <span className="text-xs text-surface-400">diese Woche</span>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-2">{t("developer.usage.month")}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-surface-900">{monthCount}</span>
            <span className="text-xs text-surface-400">diesen Monat</span>
          </div>
        </div>
      </div>

      {/* Daily Chart */}
      {data.daily.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-600" />
            {t("developer.usage.daily")}
          </h3>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.daily.map((day, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-surface-500 w-20 text-right">
                  {new Date(day.date).toLocaleDateString("de-CH", { month: "short", day: "numeric" })}
                </span>
                <div className="flex-1 bg-surface-100 rounded-full overflow-hidden h-6">
                  <div
                    className="bg-brand-500 h-full rounded-full transition-all"
                    style={{
                      width: `${(day.count / maxDaily) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-surface-700 w-12 text-right">
                  {day.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Key Breakdown */}
      {data.byKey.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-brand-600" />
            {t("developer.usage.perKey")}
          </h3>

          <div className="space-y-3">
            {data.byKey.sort((a, b) => b.count - a.count).map(key => (
              <div key={key.key_id} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-surface-800">{key.name}</p>
                  <code className="text-xs text-surface-400 font-mono">{key.key_prefix}...</code>
                </div>
                <span className="text-sm font-semibold text-brand-600">{key.count} Anfragen</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.daily.length === 0 && (
        <div className="card p-8 text-center text-surface-400">
          <p className="text-sm">Noch keine API-Anfragen registriert</p>
        </div>
      )}
    </div>
  );
}
