"use client";
import { Suspense, useState } from "react";
import { Zap, Check, Sparkles, Crown, Loader2 } from "lucide-react";
import {
  PRO_BASIC_PRICES,
  PRO_FULL_PRICES,
  LIFETIME_BASIC_PRICE,
  LIFETIME_FULL_PRICE,
  AI_ADDON_PRICE,
} from "@/lib/stripe";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

function CheckoutButton({ priceId, label, variant = "brand" }: { priceId: string; label: string; variant?: "brand" | "violet" | "dark" }) {
  const [loading, setLoading] = useState(false);
  const colors = {
    brand: "bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500 text-white",
    violet: "bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 text-white",
    dark: "bg-white/10 dark:bg-surface-800 hover:bg-white/20 dark:bg-surface-800 text-white",
  };
  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Fehler beim Erstellen der Checkout-Session");
    } catch { alert("Netzwerkfehler"); }
    finally { setLoading(false); }
  }
  return (
    <button onClick={handleCheckout} disabled={loading}
      className={`w-full py-2.5 px-6 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${colors[variant]}`}>
      {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : label}
    </button>
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
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-3">{t("upgrade.title")}</h1>
 <p className="text-sm sm:text-base text-surface-500 max-w-xl mx-auto">{t("upgrade.subtitle")}</p>

        {/* Guarantee note */}
 <p className="mt-4 text-xs text-surface-400">14 Tage Geld-zurück-Garantie · Jederzeit kündbar</p>
      </div>

      {/* Cards: Free / Basic / Full */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 max-w-4xl mx-auto mb-8">
        {/* Free */}
 <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-4 sm:p-5">
          <div className="mb-4">
 <p className="text-xs sm:text-sm font-semibold text-surface-500 uppercase tracking-wide mb-1">Free</p>
            <p className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">CHF 0</p>
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
 <div className="w-full py-3 px-6 rounded-xl border-2 border-surface-200 text-surface-500 text-xs text-center font-medium">
            {t("upgrade.currentPlan")}
          </div>
        </div>

        {/* Pro Basic */}
 <div className="bg-surface-100 rounded-2xl border-2 border-brand-500 dark:border-brand-600 p-4 sm:p-5 relative">
          <div className="absolute top-0 right-0 bg-brand-600 dark:bg-brand-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl">
            BASIC
          </div>
          <div className="mb-4">
            <p className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">Pro Basic</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
                CHF {PRO_BASIC_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
 <span className="text-xs text-surface-400">
                / {PRO_BASIC_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-1">
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
                <Check size={12} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <CheckoutButton priceId={PRO_BASIC_PRICES.yearly.priceId} label="Pro Basic wählen" variant="brand" />
          <div className="flex gap-1.5 mt-2">
            <button className="flex-1 text-[10px] text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors py-1"
              onClick={() => { const el = document.getElementById("interval-basic"); if(el) el.classList.toggle("hidden"); }}>
              Andere Laufzeiten ▾
            </button>
          </div>
          <div id="interval-basic" className="hidden mt-2 space-y-1.5">
            <CheckoutButton priceId={PRO_BASIC_PRICES.monthly.priceId} label={`Monatlich — CHF ${PRO_BASIC_PRICES.monthly.price.toFixed(2).replace(".",",")}`} variant="brand" />
            <CheckoutButton priceId={PRO_BASIC_PRICES.halfYearly.priceId} label={`6 Monate — CHF ${PRO_BASIC_PRICES.halfYearly.price.toFixed(2).replace(".",",")} (−${PRO_BASIC_PRICES.halfYearly.savings}%)`} variant="brand" />
          </div>
        </div>

        {/* Pro Full */}
 <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-brand-600 dark:from-violet-700 dark:to-brand-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Sparkles size={9} />
            FULL
          </div>
          <div className="mb-4">
            <p className="text-xs sm:text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Pro Full</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
                CHF {PRO_FULL_PRICES.yearly.price.toFixed(2).replace(".", ",")}
              </span>
 <span className="text-xs text-surface-400">
                / {PRO_FULL_PRICES.yearly.interval}
              </span>
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mt-1">
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
                <Check size={12} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <CheckoutButton priceId={PRO_FULL_PRICES.yearly.priceId} label="Pro Full wählen" variant="violet" />
          <div className="flex gap-1.5 mt-2">
            <button className="flex-1 text-[10px] text-surface-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors py-1"
              onClick={() => { const el = document.getElementById("interval-full"); if(el) el.classList.toggle("hidden"); }}>
              Andere Laufzeiten ▾
            </button>
          </div>
          <div id="interval-full" className="hidden mt-2 space-y-1.5">
            <CheckoutButton priceId={PRO_FULL_PRICES.monthly.priceId} label={`Monatlich — CHF ${PRO_FULL_PRICES.monthly.price.toFixed(2).replace(".",",")}`} variant="violet" />
            <CheckoutButton priceId={PRO_FULL_PRICES.halfYearly.priceId} label={`6 Monate — CHF ${PRO_FULL_PRICES.halfYearly.price.toFixed(2).replace(".",",")} (−${PRO_FULL_PRICES.halfYearly.savings}%)`} variant="violet" />
          </div>
        </div>
      </div>

      {/* Lifetime options */}
      <div className="max-w-4xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Lifetime Basic */}
 <div className="bg-surface-900 text-white rounded-2xl p-4 sm:p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 dark:bg-white/5 text-white/70 dark:text-white/60 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base sm:text-lg font-bold">Lifetime Basic — CHF {LIFETIME_BASIC_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs sm:text-sm text-white/50 dark:text-white/40 mt-1">{t("upgrade.lifetimeBasicDesc")}</p>
          <div className="mt-3">
            <CheckoutButton priceId={LIFETIME_BASIC_PRICE.priceId} label="Lifetime Basic kaufen" variant="dark" />
          </div>
        </div>

        {/* Lifetime Full */}
 <div className="bg-gradient-to-br from-violet-900 dark:from-violet-950 to-surface-900 text-white rounded-2xl p-4 sm:p-5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 dark:bg-white/5 text-white/70 dark:text-white/60 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
            <Crown size={10} />
            <Sparkles size={10} />
            {t("upgrade.oneTimePurchase")}
          </div>
          <p className="text-base sm:text-lg font-bold">Lifetime Full — CHF {LIFETIME_FULL_PRICE.price.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs sm:text-sm text-white/50 dark:text-white/40 mt-1">{t("upgrade.lifetimeFullDesc")}</p>
          <div className="mt-3">
            <CheckoutButton priceId={LIFETIME_FULL_PRICE.priceId} label="Lifetime Full kaufen" variant="dark" />
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
              <p className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">
                {AI_ADDON_PRICE.label} — CHF {AI_ADDON_PRICE.price.toFixed(2).replace(".", ",")}
              </p>
 <p className="text-xs sm:text-sm text-surface-500 mt-1">{t("upgrade.addonDesc")}</p>
            </div>
            <div className="shrink-0">
              <CheckoutButton priceId={AI_ADDON_PRICE.priceId} label="+200 KI-Requests kaufen" variant="violet" />
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
 <p className="text-xs sm:text-sm text-surface-600">{t("upgrade.allPlatformsDesc")}</p>
        </div>
      </div>

 <p className="text-center text-xs text-surface-400 px-3">
        Sichere Zahlung via Stripe · Alle Preise in CHF inkl. MwSt.
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
