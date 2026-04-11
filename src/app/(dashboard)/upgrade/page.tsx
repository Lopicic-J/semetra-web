"use client";
import { Suspense } from "react";
import { Zap, Check, Sparkles, Crown, Clock } from "lucide-react";
import {
  PRO_BASIC_PRICES,
  PRO_FULL_PRICES,
  LIFETIME_BASIC_PRICE,
  LIFETIME_FULL_PRICE,
  AI_ADDON_PRICE,
} from "@/lib/stripe";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

function ComingSoonBadge() {
  return (
    <div className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs text-center font-semibold flex items-center justify-center gap-1.5">
      <Clock size={13} />
      Coming Soon
    </div>
  );
}

function UpgradeContent() {
  const { t } = useTranslation();

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Zap size={14} />
          Semetra Pro
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50 mb-3">{t("upgrade.title")}</h1>
        <p className="text-sm sm:text-base text-surface-500 dark:text-surface-400 max-w-xl mx-auto">{t("upgrade.subtitle")}</p>

        {/* Coming Soon Banner */}
        <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium">
          <Clock size={16} />
          <span>Kaufoptionen werden in Kürze freigeschaltet — Semetra befindet sich aktuell in der Entwicklungsphase.</span>
        </div>
      </div>

      {/* Cards: Free / Basic / Full */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 max-w-4xl mx-auto mb-8">
        {/* Free */}
        <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl border-2 border-surface-200 dark:border-surface-700 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs sm:text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-1">Free</p>
            <p className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50">CHF 0</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{t("upgrade.forever")}</p>
          </div>
          <div className="space-y-2 mb-5">
            {[
              t("upgrade.free.f1"),
              t("upgrade.free.f2"),
              t("upgrade.free.f3"),
              t("upgrade.free.f4"),
              t("upgrade.free.f5"),
              t("upgrade.free.f6"),
              t("upgrade.free.f7"),
              t("upgrade.free.f8"),
              t("upgrade.free.f9"),
              t("upgrade.free.f10"),
              t("upgrade.free.f11"),
              t("upgrade.free.f12"),
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-surface-600 dark:text-surface-400">
                <Check size={12} className="text-surface-400 dark:text-surface-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <div className="w-full py-3 px-6 rounded-xl border-2 border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 text-xs text-center font-medium">
            {t("upgrade.currentPlan")}
          </div>
        </div>

        {/* Pro Basic */}
        <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl border-2 border-brand-500 dark:border-brand-600 p-4 sm:p-5 relative">
          <div className="absolute top-0 right-0 bg-brand-600 dark:bg-brand-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl">
            BASIC
          </div>
          <div className="mb-4">
            <p className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">Pro Basic</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50">
                CHF {PRO_BASIC_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400 dark:text-surface-500">
                / {PRO_BASIC_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-1">
              = CHF {PRO_BASIC_PRICES.yearly.perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{t("upgrade.cancellable")}</p>
          </div>
          <div className="space-y-2 mb-5">
            {[
              t("upgrade.basic.f1"),
              t("upgrade.basic.f2"),
              PRO_BASIC_PRICES.yearly.aiLabel,
              t("upgrade.basic.f4"),
              t("upgrade.basic.f5"),
              t("upgrade.basic.f6"),
              t("upgrade.basic.f7"),
              t("upgrade.basic.f8"),
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-surface-700 dark:text-surface-300">
                <Check size={12} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <ComingSoonBadge />
        </div>

        {/* Pro Full */}
        <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl border-2 border-surface-200 dark:border-surface-700 p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-brand-600 dark:from-violet-700 dark:to-brand-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Sparkles size={9} />
            FULL
          </div>
          <div className="mb-4">
            <p className="text-xs sm:text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Pro Full</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50">
                CHF {PRO_FULL_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400 dark:text-surface-500">
                / {PRO_FULL_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mt-1">
              = CHF {PRO_FULL_PRICES.yearly.perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{t("upgrade.cancellable")}</p>
          </div>
          <div className="space-y-2 mb-5">
            {[
              t("upgrade.full.f1"),
              PRO_FULL_PRICES.yearly.aiLabel,
              t("upgrade.full.f3"),
              t("upgrade.full.f4"),
              t("upgrade.full.f5"),
              t("upgrade.full.f6"),
              t("upgrade.full.f7"),
              t("upgrade.full.f8"),
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-surface-700 dark:text-surface-300">
                <Check size={12} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <ComingSoonBadge />
        </div>
      </div>

      {/* Lifetime options */}
      <div className="max-w-4xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Lifetime Basic */}
        <div className="bg-surface-900 dark:bg-surface-950 text-white rounded-2xl p-4 sm:p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 dark:bg-white/5 text-white/70 dark:text-white/60 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base sm:text-lg font-bold">Lifetime Basic — CHF {LIFETIME_BASIC_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs sm:text-sm text-white/50 dark:text-white/40 mt-1">{t("upgrade.lifetimeBasicDesc")}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 dark:bg-amber-900/40 text-amber-300 dark:text-amber-400 px-4 py-2 rounded-xl font-semibold text-xs">
            <Clock size={12} />
            Coming Soon
          </div>
        </div>

        {/* Lifetime Full */}
        <div className="bg-gradient-to-br from-violet-900 dark:from-violet-950 to-surface-900 dark:to-surface-950 text-white rounded-2xl p-4 sm:p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 dark:bg-white/5 text-white/70 dark:text-white/60 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            <Sparkles size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base sm:text-lg font-bold">Lifetime Full — CHF {LIFETIME_FULL_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs sm:text-sm text-white/50 dark:text-white/40 mt-1">{t("upgrade.lifetimeFullDesc")}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 dark:bg-amber-900/40 text-amber-300 dark:text-amber-400 px-4 py-2 rounded-xl font-semibold text-xs">
            <Clock size={12} />
            Coming Soon
          </div>
        </div>
      </div>

      {/* AI Add-on */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-violet-50 dark:from-violet-950/40 to-purple-50 dark:to-purple-950/40 border border-violet-200/60 dark:border-violet-800/40 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-400 text-xs font-semibold mb-1 uppercase tracking-wide">
                <Sparkles size={12} />
                KI Add-on
              </div>
              <p className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-50">
                {AI_ADDON_PRICE.label} — CHF {AI_ADDON_PRICE.price.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1">{t("upgrade.addonDesc")}</p>
            </div>
            <div className="shrink-0 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-xl font-semibold text-xs">
              <Clock size={12} />
              Coming Soon
            </div>
          </div>
        </div>
      </div>

      {/* Platform info */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-brand-50 dark:from-brand-950/40 to-violet-50 dark:to-violet-950/40 border border-brand-200/60 dark:border-brand-800/40 rounded-2xl p-4 sm:p-5 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-2">
            <Sparkles size={16} className="text-brand-600 dark:text-brand-400" />
            <span className="text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-300">{t("upgrade.allPlatforms")}</span>
          </div>
          <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400">{t("upgrade.allPlatformsDesc")}</p>
        </div>
      </div>

      <p className="text-center text-xs text-surface-400 dark:text-surface-500 px-3">
        Preise und Funktionen können sich bis zum offiziellen Launch noch ändern.
      </p>
    </div>
  );
}

export default function UpgradePage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="p-6">{t("upgrade.upgrading")}</div>}>
      <UpgradeContent />
    </Suspense>
  );
}
