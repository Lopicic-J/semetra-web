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
    <div className="w-full py-2.5 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 text-xs text-center font-semibold flex items-center justify-center gap-1.5">
      <Clock size={13} />
      Coming Soon
    </div>
  );
}

function UpgradeContent() {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Zap size={14} />
          Semetra Pro
        </div>
        <h1 className="text-3xl font-bold text-surface-900 mb-3">{t("upgrade.title")}</h1>
        <p className="text-surface-500 max-w-xl mx-auto">{t("upgrade.subtitle")}</p>

        {/* Coming Soon Banner */}
        <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-2.5 rounded-xl text-sm font-medium">
          <Clock size={16} />
          Kaufoptionen werden in Kürze freigeschaltet — Semetra befindet sich aktuell in der Entwicklungsphase.
        </div>
      </div>

      {/* Cards: Free / Basic / Full */}
      <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-8">
        {/* Free */}
        <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-1">Free</p>
            <p className="text-2xl font-bold text-surface-900">CHF 0</p>
            <p className="text-xs text-surface-400 mt-1">{t("upgrade.forever")}</p>
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
              <div key={f} className="flex items-start gap-2 text-xs text-surface-600">
                <Check size={12} className="text-surface-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <div className="w-full py-2 rounded-xl border-2 border-surface-200 text-surface-500 text-xs text-center font-medium">
            {t("upgrade.currentPlan")}
          </div>
        </div>

        {/* Pro Basic */}
        <div className="bg-surface-100 rounded-2xl border-2 border-brand-500 p-5 relative">
          <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl">
            BASIC
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Pro Basic</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-surface-900">
                CHF {PRO_BASIC_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400">
                / {PRO_BASIC_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-brand-600 font-medium mt-1">
              = CHF {PRO_BASIC_PRICES.yearly.perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
            </p>
            <p className="text-xs text-surface-400 mt-1">{t("upgrade.cancellable")}</p>
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
              <div key={f} className="flex items-start gap-2 text-xs text-surface-700">
                <Check size={12} className="text-brand-600 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <ComingSoonBadge />
        </div>

        {/* Pro Full */}
        <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Sparkles size={9} />
            FULL
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-1">Pro Full</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-surface-900">
                CHF {PRO_FULL_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400">
                / {PRO_FULL_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-violet-600 font-medium mt-1">
              = CHF {PRO_FULL_PRICES.yearly.perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
            </p>
            <p className="text-xs text-surface-400 mt-1">{t("upgrade.cancellable")}</p>
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
              <div key={f} className="flex items-start gap-2 text-xs text-surface-700">
                <Check size={12} className="text-violet-600 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <ComingSoonBadge />
        </div>
      </div>

      {/* Lifetime options */}
      <div className="max-w-4xl mx-auto mb-8 grid sm:grid-cols-2 gap-4">
        {/* Lifetime Basic */}
        <div className="bg-surface-900 text-white rounded-2xl p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base font-bold">Lifetime Basic — CHF {LIFETIME_BASIC_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-white/50 mt-1">{t("upgrade.lifetimeBasicDesc")}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-xl font-semibold text-xs">
            <Clock size={12} />
            Coming Soon
          </div>
        </div>

        {/* Lifetime Full */}
        <div className="bg-gradient-to-br from-violet-900 to-surface-900 text-white rounded-2xl p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            <Sparkles size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base font-bold">Lifetime Full — CHF {LIFETIME_FULL_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-white/50 mt-1">{t("upgrade.lifetimeFullDesc")}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-xl font-semibold text-xs">
            <Clock size={12} />
            Coming Soon
          </div>
        </div>
      </div>

      {/* AI Add-on */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-1.5 text-violet-700 text-xs font-semibold mb-1 uppercase tracking-wide">
                <Sparkles size={12} />
                KI Add-on
              </div>
              <p className="text-base font-bold text-surface-900">
                {AI_ADDON_PRICE.label} — CHF {AI_ADDON_PRICE.price.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-surface-500 mt-1">{t("upgrade.addonDesc")}</p>
            </div>
            <div className="shrink-0 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl font-semibold text-xs">
              <Clock size={12} />
              Coming Soon
            </div>
          </div>
        </div>
      </div>

      {/* Platform info */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-200/60 rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={16} className="text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">{t("upgrade.allPlatforms")}</span>
          </div>
          <p className="text-sm text-surface-600">{t("upgrade.allPlatformsDesc")}</p>
        </div>
      </div>

      <p className="text-center text-xs text-surface-400">
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
