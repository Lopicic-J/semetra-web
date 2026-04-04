"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { CheckCircle, XCircle, Zap, Check, ArrowLeft, Star, Sparkles, Crown } from "lucide-react";
import {
  PRO_BASIC_PRICES,
  PRO_FULL_PRICES,
  LIFETIME_BASIC_PRICE,
  LIFETIME_FULL_PRICE,
  AI_ADDON_PRICE,
} from "@/lib/stripe";
import type { PriceTier } from "@/lib/stripe";
import { useProfile } from "@/lib/hooks/useProfile";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  // Pro Basic (old prices)
  "price_1TG9kaRNHcFqFbgIthnElTOy": "https://buy.stripe.com/14A3cxbsw2Oo7ui9arfYY01",
  "price_1TG9kdRNHcFqFbgIlTDxPRla": "https://buy.stripe.com/dRmdRb548agQdSGcmDfYY00",
  "price_1TG9kZRNHcFqFbgI6F0O2tqs": "https://buy.stripe.com/7sY5kFfIM9cM9Cq5YffYY02",
  // Lifetime Basic
  [LIFETIME_BASIC_PRICE.priceId]: LIFETIME_BASIC_PRICE.paymentLink,
};

function UpgradeContent() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const { isPro, isLifetime, planTier, aiCredits, refetch } = useProfile();
  const [selectedTier, setSelectedTier] = useState<PriceTier>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "full">("full");

  useEffect(() => {
    if (success) {
      const timer = setTimeout(refetch, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, refetch]);

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle className="text-green-500" size={44} />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">{t("upgrade.successTitle")}</h1>
        <p className="text-surface-500 mb-8 max-w-sm">{t("upgrade.successSubtitle")}</p>
        <Link href="/dashboard" className="btn-primary gap-2">
          <ArrowLeft size={16} />
          {t("upgrade.successButton")}
        </Link>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <div className="w-24 h-24 rounded-full bg-surface-100 flex items-center justify-center mb-6">
          <XCircle className="text-surface-400" size={44} />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">{t("upgrade.cancelledTitle")}</h1>
        <p className="text-surface-500 mb-8">{t("upgrade.cancelledSubtitle")}</p>
        <Link href="/dashboard" className="btn-secondary">{t("upgrade.cancelledButton")}</Link>
      </div>
    );
  }

  const basicTiers = [
    { key: "monthly" as PriceTier, ...PRO_BASIC_PRICES.monthly },
    { key: "halfYearly" as PriceTier, ...PRO_BASIC_PRICES.halfYearly },
    { key: "yearly" as PriceTier, ...PRO_BASIC_PRICES.yearly },
  ];

  const fullTiers = [
    { key: "monthly" as PriceTier, ...PRO_FULL_PRICES.monthly },
    { key: "halfYearly" as PriceTier, ...PRO_FULL_PRICES.halfYearly },
    { key: "yearly" as PriceTier, ...PRO_FULL_PRICES.yearly },
  ];

  const activePrices = selectedPlan === "full" ? fullTiers : basicTiers;
  const activePrice = activePrices.find(t => t.key === selectedTier) ?? activePrices[2];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Zap size={14} />
          Semetra Pro
        </div>
        <h1 className="text-3xl font-bold text-surface-900 mb-3">{t("upgrade.title")}</h1>
        <p className="text-surface-500 max-w-xl mx-auto">{t("upgrade.subtitle")}</p>
      </div>

      {/* Plan toggle: Basic vs Full */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-surface-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSelectedPlan("basic")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedPlan === "basic"
                ? "bg-white text-surface-900 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            Pro Basic
          </button>
          <button
            onClick={() => setSelectedPlan("full")}
            className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedPlan === "full"
                ? "bg-white text-surface-900 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            Pro Full
            <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              KI
            </span>
          </button>
        </div>
      </div>

      {/* Billing period selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-surface-100 rounded-xl p-1 gap-1">
          {[
            { key: "monthly" as PriceTier, label: t("upgrade.monthly") },
            { key: "halfYearly" as PriceTier, label: t("upgrade.halfYearly") },
            { key: "yearly" as PriceTier, label: t("upgrade.yearly") },
          ].map((tier) => {
            const prices = selectedPlan === "full" ? PRO_FULL_PRICES : PRO_BASIC_PRICES;
            const priceObj = prices[tier.key];
            return (
              <button
                key={tier.key}
                onClick={() => setSelectedTier(tier.key)}
                className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  selectedTier === tier.key
                    ? "bg-white text-surface-900 shadow-sm"
                    : "text-surface-500 hover:text-surface-700"
                }`}
              >
                {tier.label}
                {"savings" in priceObj && (
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    -{(priceObj as { savings: number }).savings}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards: Free / Basic / Full */}
      <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-8">
        {/* Free */}
        <div className="bg-white rounded-2xl border-2 border-surface-200 p-5">
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
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-surface-600">
                <Check size={12} className="text-surface-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {!isPro && (
            <div className="w-full py-2 rounded-xl border-2 border-surface-200 text-surface-500 text-xs text-center font-medium">
              {t("upgrade.currentPlan")}
            </div>
          )}
        </div>

        {/* Pro Basic */}
        <div className={`bg-white rounded-2xl border-2 p-5 relative ${
          selectedPlan === "basic" ? "border-brand-500" : "border-surface-200"
        }`}>
          <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl">
            BASIC
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Pro Basic</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-surface-900">
                CHF {activePrice && selectedPlan === "basic"
                  ? PRO_BASIC_PRICES[selectedTier].price.toFixed(2).replace(".", ",")
                  : PRO_BASIC_PRICES[selectedTier].price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400">
                / {PRO_BASIC_PRICES[selectedTier].interval}
              </span>
            </div>
            {PRO_BASIC_PRICES[selectedTier].intervalCount > 1 && (
              <p className="text-xs text-brand-600 font-medium mt-1">
                = CHF {PRO_BASIC_PRICES[selectedTier].perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
              </p>
            )}
            <p className="text-xs text-surface-400 mt-1">{t("upgrade.cancellable")}</p>
          </div>
          <div className="space-y-2 mb-5">
            {[
              t("upgrade.basic.f1"),
              t("upgrade.basic.f2"),
              PRO_BASIC_PRICES[selectedTier].aiLabel,
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
          {isPro && planTier === "basic" ? (
            <div className="w-full py-2 rounded-xl bg-green-50 text-green-700 text-xs text-center font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle size={13} />
              {t("upgrade.activePlan")}
            </div>
          ) : !isPro ? (
            <UpgradeButton priceId={PRO_BASIC_PRICES[selectedTier].priceId} />
          ) : null}
        </div>

        {/* Pro Full */}
        <div className={`bg-white rounded-2xl border-2 p-5 relative overflow-hidden ${
          selectedPlan === "full" ? "border-brand-500" : "border-surface-200"
        }`}>
          <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Sparkles size={9} />
            FULL
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-1">Pro Full</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-surface-900">
                CHF {PRO_FULL_PRICES[selectedTier].price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-surface-400">
                / {PRO_FULL_PRICES[selectedTier].interval}
              </span>
            </div>
            {PRO_FULL_PRICES[selectedTier].intervalCount > 1 && (
              <p className="text-xs text-violet-600 font-medium mt-1">
                = CHF {PRO_FULL_PRICES[selectedTier].perMonth.toFixed(2).replace(".", ",")} {t("upgrade.perMonth")}
                {"savings" in PRO_FULL_PRICES[selectedTier] && (
                  <span className="ml-1 text-green-600 font-semibold">
                    ({t("upgrade.savings", { percent: (PRO_FULL_PRICES[selectedTier] as { savings: number }).savings })})
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-surface-400 mt-1">{t("upgrade.cancellable")}</p>
          </div>
          <div className="space-y-2 mb-5">
            {[
              t("upgrade.full.f1"),
              PRO_FULL_PRICES[selectedTier].aiLabel,
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
          {isPro && planTier === "full" ? (
            <div className="w-full py-2 rounded-xl bg-green-50 text-green-700 text-xs text-center font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle size={13} />
              {t("upgrade.activePlan")}
            </div>
          ) : (
            <UpgradeButton priceId={PRO_FULL_PRICES[selectedTier].priceId} variant="full" />
          )}
        </div>
      </div>

      {/* Lifetime options */}
      {!isLifetime && (
        <div className="max-w-4xl mx-auto mb-8 grid sm:grid-cols-2 gap-4">
          {/* Lifetime Basic */}
          <div className="bg-surface-900 text-white rounded-2xl p-5">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
              <Crown size={10} />
              {t("upgrade.oneTimePurchase")}
            </div>
            <p className="text-base font-bold">Lifetime Basic — CHF {LIFETIME_BASIC_PRICE.price.toFixed(2).replace(".", ",")}</p>
            <p className="text-xs text-white/50 mt-1">{t("upgrade.lifetimeBasicDesc")}</p>
            <a
              href={LIFETIME_BASIC_PRICE.paymentLink}
              className="mt-3 inline-block bg-white text-surface-900 px-5 py-2 rounded-xl font-semibold text-xs hover:bg-surface-100 transition-all"
            >
              {t("upgrade.buyLifetime")}
            </a>
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
            {LIFETIME_FULL_PRICE.paymentLink ? (
              <a
                href={LIFETIME_FULL_PRICE.paymentLink}
                className="mt-3 inline-block bg-white text-surface-900 px-5 py-2 rounded-xl font-semibold text-xs hover:bg-surface-100 transition-all"
              >
                {t("upgrade.buyLifetime")}
              </a>
            ) : (
              <LifetimeFullButton />
            )}
          </div>
        </div>
      )}

      {/* AI Add-on — visible to all users */}
      {(
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
                {aiCredits > 0 && (
                  <p className="text-xs text-violet-600 font-medium mt-1">
                    {t("upgrade.addonRemaining", { count: String(aiCredits) })}
                  </p>
                )}
              </div>
              <AddonButton />
            </div>
          </div>
        </div>
      )}

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

      <p className="text-center text-xs text-surface-400">{t("upgrade.securePayment")}</p>
    </div>
  );
}

function AddonButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_id: AI_ADDON_PRICE.priceId, mode: "payment" }),
          });
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }}
      className="shrink-0 bg-violet-600 text-white px-5 py-2 rounded-xl font-semibold text-xs hover:bg-violet-500 transition-all disabled:opacity-60"
    >
      <Sparkles size={12} className="inline mr-1" />
      {loading ? t("upgrade.upgrading") : t("upgrade.buyAddon")}
    </button>
  );
}

function LifetimeFullButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_id: LIFETIME_FULL_PRICE.priceId, mode: "payment" }),
          });
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }}
      className="mt-3 inline-block bg-white text-surface-900 px-5 py-2 rounded-xl font-semibold text-xs hover:bg-surface-100 transition-all disabled:opacity-60"
    >
      {loading ? t("upgrade.upgrading") : t("upgrade.buyLifetime")}
    </button>
  );
}

function UpgradeButton({ priceId, variant = "basic" }: { priceId: string; variant?: "basic" | "full" }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const isFull = variant === "full";

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_id: priceId }),
          });
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          // API failed — fall through to direct link
        }
        const directLink = STRIPE_PAYMENT_LINKS[priceId];
        if (directLink) {
          window.location.href = directLink;
        }
        setLoading(false);
      }}
      className={`w-full py-2.5 rounded-xl text-white font-semibold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-md ${
        isFull
          ? "bg-gradient-to-r from-violet-600 to-brand-600 shadow-violet-600/20"
          : "bg-brand-600 shadow-brand-600/20"
      }`}
    >
      <Zap size={13} />
      {loading ? t("upgrade.upgrading") : t("upgrade.nowUpgrade")}
    </button>
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
