"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { CheckCircle, XCircle, Zap, Check, ArrowLeft, Star, Sparkles } from "lucide-react";
import { PLANS, PRO_PRICES, LIFETIME_PRICE } from "@/lib/stripe";
import type { PriceTier } from "@/lib/stripe";
import { useProfile } from "@/lib/hooks/useProfile";
import Link from "next/link";

const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  "price_1TG9kaRNHcFqFbgIthnElTOy": "https://buy.stripe.com/14A3cxbsw2Oo7ui9arfYY01",
  "price_1TG9kdRNHcFqFbgIlTDxPRla": "https://buy.stripe.com/dRmdRb548agQdSGcmDfYY00",
  "price_1TG9kZRNHcFqFbgI6F0O2tqs": "https://buy.stripe.com/7sY5kFfIM9cM9Cq5YffYY02",
};

function UpgradeContent() {
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const { isPro, isLifetime, refetch } = useProfile();
  const [selectedTier, setSelectedTier] = useState<PriceTier>("yearly");

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
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Willkommen bei Semetra Pro!</h1>
        <p className="text-surface-500 mb-8 max-w-sm">
          Dein Upgrade war erfolgreich. Alle Pro-Features sind jetzt freigeschaltet — auf Web und Desktop.
        </p>
        <Link href="/dashboard" className="btn-primary gap-2">
          <ArrowLeft size={16} />
          Zum Dashboard
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
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Upgrade abgebrochen</h1>
        <p className="text-surface-500 mb-8">Kein Problem — du kannst jederzeit upgraden.</p>
        <Link href="/dashboard" className="btn-secondary">Zurück zum Dashboard</Link>
      </div>
    );
  }

  const tiers = [
    { key: "monthly" as PriceTier, ...PRO_PRICES.monthly },
    { key: "halfYearly" as PriceTier, ...PRO_PRICES.halfYearly },
    { key: "yearly" as PriceTier, ...PRO_PRICES.yearly },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Zap size={14} />
          Semetra Pro
        </div>
        <h1 className="text-3xl font-bold text-surface-900 mb-3">
          Hol das Beste aus deinem Studium heraus
        </h1>
        <p className="text-surface-500 max-w-xl mx-auto">
          Ein Abo, alle Plattformen. Upgrade auf Pro und schalte unbegrenzte Features, KI-Coach und Desktop-Sync frei.
        </p>
      </div>

      {/* Pricing tier selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-surface-100 rounded-xl p-1 gap-1">
          {tiers.map((tier) => (
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
              {"savings" in tier && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  -{tier.savings}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
        {/* Free */}
        <div className="bg-white rounded-2xl border-2 border-surface-200 p-6">
          <div className="mb-5">
            <p className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-1">Free</p>
            <p className="text-3xl font-bold text-surface-900">CHF 0</p>
            <p className="text-sm text-surface-400 mt-1">für immer</p>
          </div>
          <div className="space-y-2.5 mb-6">
            {PLANS.free.features.map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-surface-600">
                <Check size={14} className="text-surface-400 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
            {PLANS.free.lockedFeatures.map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-surface-400 line-through">
                <Check size={14} className="text-surface-200 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {!isPro && (
            <div className="w-full py-2.5 rounded-xl border-2 border-surface-200 text-surface-500 text-sm text-center font-medium">
              Dein aktueller Plan
            </div>
          )}
        </div>

        {/* Pro */}
        <div className="bg-white rounded-2xl border-2 border-brand-500 p-6 relative overflow-hidden">
          {PRO_PRICES[selectedTier] && "popular" in PRO_PRICES[selectedTier] && (
            <div className="absolute top-0 right-0 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
              <Star size={10} fill="white" />
              BELIEBTESTE WAHL
            </div>
          )}
          {!("popular" in PRO_PRICES[selectedTier]) && (
            <div className="absolute top-0 right-0 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              PRO
            </div>
          )}
          <div className="mb-5">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Pro</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-surface-900">
                CHF {PRO_PRICES[selectedTier].price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-sm text-surface-400">
                / {PRO_PRICES[selectedTier].interval}
              </span>
            </div>
            {PRO_PRICES[selectedTier].intervalCount > 1 && (
              <p className="text-sm text-brand-600 font-medium mt-1">
                = CHF {PRO_PRICES[selectedTier].perMonth.toFixed(2).replace(".", ",")} pro Monat
                {"savings" in PRO_PRICES[selectedTier] && (
                  <span className="ml-1.5 text-green-600 font-semibold">
                    ({(PRO_PRICES[selectedTier] as { savings: number }).savings}% gespart)
                  </span>
                )}
              </p>
            )}
            <p className="text-sm text-surface-400 mt-1">jederzeit kündbar</p>
          </div>
          <div className="space-y-2.5 mb-6">
            {PLANS.pro.features.map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-surface-700">
                <Check size={14} className="text-brand-600 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {isPro ? (
            <div className="w-full py-2.5 rounded-xl bg-green-50 text-green-700 text-sm text-center font-semibold flex items-center justify-center gap-2">
              <CheckCircle size={15} />
              Aktiver Plan
            </div>
          ) : (
            <UpgradeButton priceId={PRO_PRICES[selectedTier].priceId} />
          )}
        </div>
      </div>

      {/* Lifetime option */}
      {!isPro && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-surface-900 text-white rounded-2xl p-6 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-xs font-semibold px-2.5 py-1 rounded-full mb-2 uppercase tracking-wide">
                Einmalkauf
              </div>
              <p className="text-lg font-bold">Pro Lifetime — CHF {LIFETIME_PRICE.price.toFixed(2).replace(".", ",")}</p>
              <p className="text-sm text-white/50 mt-1">Einmalig zahlen, dauerhaft Pro. Kein Abo. Gilt f&uuml;r Desktop, Web &amp; Mobile.</p>
            </div>
            <a
              href={LIFETIME_PRICE.paymentLink}
              className="shrink-0 bg-white text-surface-900 px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-100 transition-all"
            >
              Lifetime kaufen
            </a>
          </div>
        </div>
      )}

      {/* Platform info */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-200/60 rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={16} className="text-brand-600" />
            <span className="text-sm font-semibold text-brand-700">Ein Kauf oder Abo — &uuml;berall Pro</span>
          </div>
          <p className="text-sm text-surface-600">
            Dein Pro gilt f&uuml;r Web-App, Desktop-App und zuk&uuml;nftige Mobile-App. Einmal aktivieren, &uuml;berall nutzen.
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-surface-400">
        Sichere Zahlung via Stripe · Schweizer Datenschutz · Keine versteckten Kosten
      </p>
    </div>
  );
}

function UpgradeButton({ priceId }: { priceId: string }) {
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
        // Fallback: direct Stripe Payment Link
        const directLink = STRIPE_PAYMENT_LINKS[priceId];
        if (directLink) {
          window.location.href = directLink;
        }
        setLoading(false);
      }}
      className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-brand-600/20"
    >
      <Zap size={16} />
      {loading ? "Wird geladen…" : "Jetzt upgraden"}
    </button>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="p-6">Lade…</div>}>
      <UpgradeContent />
    </Suspense>
  );
}
