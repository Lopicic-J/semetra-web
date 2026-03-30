"use client";
import { useState } from "react";
import { Lock, Zap, X, Check, Loader2, Star } from "lucide-react";
import { PLANS, PRO_PRICES } from "@/lib/stripe";
import type { ProFeature } from "@/lib/gates";
import { PRO_FEATURES } from "@/lib/gates";
import Link from "next/link";

interface ProGateProps {
  feature: ProFeature;
  isPro: boolean;
  children: React.ReactNode;
  /** If true, renders children grayed out with a lock overlay instead of hiding them */
  overlay?: boolean;
}

export function ProGate({ feature, isPro, children, overlay = false }: ProGateProps) {
  if (isPro) return <>{children}</>;

  if (overlay) {
    return (
      <div className="relative">
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
          <Link
            href="/upgrade"
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-violet-700 transition-colors"
          >
            <Lock size={14} />
            Pro-Feature freischalten
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center mb-4">
        <Lock className="text-violet-500" size={32} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{PRO_FEATURES[feature]}</h2>
      <p className="text-gray-500 text-sm mb-5">
        Dieses Feature ist nur für Pro-Nutzer verfügbar.
      </p>
      <Link
        href="/upgrade"
        className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors"
      >
        <Zap size={15} />
        Jetzt upgraden — ab CHF 3.33/Mt.
      </Link>
    </div>
  );
}

type PriceTierKey = "monthly" | "halfYearly" | "yearly";

export function UpgradeModal({ feature, onClose }: { feature?: ProFeature; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>("yearly");

  const tiers: { key: PriceTierKey; label: string; price: string; sub: string; popular?: boolean }[] = [
    { key: "monthly",    label: "Monatlich",   price: "CHF 4.90/Mt.",  sub: "monatlich kündbar" },
    { key: "halfYearly", label: "6 Monate",    price: "CHF 4.15/Mt.",  sub: "CHF 24.90 alle 6 Mt." },
    { key: "yearly",     label: "12 Monate",   price: "CHF 3.33/Mt.",  sub: "CHF 39.90/Jahr · 32% sparen", popular: true },
  ];

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const priceId = PRO_PRICES[selectedTier].priceId;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout-Fehler");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={20} />
            <span className="font-bold text-lg">Semetra Pro</span>
          </div>
          {feature && (
            <p className="text-violet-200 text-sm">
              Schalte <strong className="text-white">{PRO_FEATURES[feature]}</strong> und alle weiteren Pro-Features frei.
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Tier selector */}
          <div className="space-y-2 mb-5">
            {tiers.map(t => (
              <button
                key={t.key}
                onClick={() => setSelectedTier(t.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                  selectedTier === t.key
                    ? "border-violet-600 bg-violet-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedTier === t.key ? "border-violet-600" : "border-gray-300"
                }`}>
                  {selectedTier === t.key && <div className="w-2 h-2 rounded-full bg-violet-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                    {t.popular && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Star size={8} /> Beliebt
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{t.sub}</span>
                </div>
                <span className="text-sm font-bold text-violet-600">{t.price}</span>
              </button>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-2 mb-5">
            {PLANS.pro.features.map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                <Check size={16} className="text-violet-600 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Weiterleitung zu Stripe...</>
              : <><Zap size={16} /> Jetzt upgraden</>
            }
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Sichere Zahlung via Stripe · Jederzeit kündbar
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small inline lock badge for sidebar items */
export function ProBadge() {
  return (
    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Lock size={8} />
      PRO
    </span>
  );
}
