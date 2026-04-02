"use client";
import { useState } from "react";
import { Lock, Zap, X, Check, Loader2, Star, Sparkles, ArrowRight } from "lucide-react";
import { PLANS, PRO_PRICES } from "@/lib/stripe";
import type { ProFeature } from "@/lib/gates";
import { PRO_FEATURES, FREE_LIMITS } from "@/lib/gates";
import Link from "next/link";

/* ─── ProGate: wraps content that requires Pro ─── */
interface ProGateProps {
  feature: ProFeature;
  isPro: boolean;
  children: React.ReactNode;
  /** overlay = grayed out with lock, inline = small banner, full = full page block */
  mode?: "overlay" | "inline" | "full";
}

export function ProGate({ feature, isPro, children, mode = "full" }: ProGateProps) {
  if (isPro) return <>{children}</>;

  if (mode === "overlay") {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[1px]">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Link
            href="/upgrade"
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg hover:bg-brand-500 transition-all hover:scale-105"
          >
            <Zap size={14} />
            {PRO_FEATURES[feature]} freischalten
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "inline") {
    return (
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-200/60 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800">{PRO_FEATURES[feature]}</p>
          <p className="text-xs text-surface-500">Verfügbar mit Semetra Pro</p>
        </div>
        <Link
          href="/upgrade"
          className="shrink-0 flex items-center gap-1.5 bg-brand-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-500 transition-colors"
        >
          Freischalten <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  // mode === "full"
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 flex items-center justify-center mb-5">
        <Lock className="text-brand-600" size={24} />
      </div>
      <h2 className="text-lg font-bold text-surface-900 mb-1">{PRO_FEATURES[feature]}</h2>
      <p className="text-surface-500 text-sm mb-6 max-w-sm">
        Dieses Feature ist Teil von Semetra Pro. Schalte es frei und hol das Beste aus deinem Studium.
      </p>
      <Link
        href="/upgrade"
        className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-500 transition-all hover:scale-[1.02] shadow-md shadow-brand-600/20"
      >
        <Zap size={15} />
        Pro freischalten — ab CHF 3.33/Mt.
      </Link>
    </div>
  );
}

/* ─── LimitNudge: soft banner when approaching/hitting a usage limit ─── */
interface LimitNudgeProps {
  current: number;
  max: number;
  label: string;        // e.g. "Notizen", "Mind Maps"
  isPro: boolean;
}

export function LimitNudge({ current, max, isPro, label }: LimitNudgeProps) {
  if (isPro || current < max) return null;

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl px-4 py-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <Sparkles size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800">
          {current}/{max} {label} erreicht
        </p>
        <p className="text-xs text-surface-500">
          Upgrade auf Pro für unbegrenzte {label}
        </p>
      </div>
      <Link
        href="/upgrade"
        className="shrink-0 flex items-center gap-1.5 bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors"
      >
        Freischalten <ArrowRight size={12} />
      </Link>
    </div>
  );
}

/* ─── LimitCounter: small inline counter showing usage ─── */
interface LimitCounterProps {
  current: number;
  max: number;
  isPro: boolean;
}

export function LimitCounter({ current, max, isPro }: LimitCounterProps) {
  if (isPro) return null;
  const pct = Math.min(100, (current / max) * 100);
  const isNear = pct >= 80;
  const isMax = current >= max;

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isMax ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-medium ${isMax ? "text-red-600" : isNear ? "text-amber-600" : "text-surface-500"}`}>
        {current}/{max}
      </span>
    </div>
  );
}

/* ─── UpgradeModal ─── */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={20} />
            <span className="font-bold text-lg">Semetra Pro</span>
          </div>
          {feature ? (
            <p className="text-brand-200 text-sm">
              Schalte <strong className="text-white">{PRO_FEATURES[feature]}</strong> und alle weiteren Pro-Features frei.
            </p>
          ) : (
            <p className="text-brand-200 text-sm">
              Hol das Beste aus deinem Studium — auf allen Geräten.
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
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  selectedTier === t.key
                    ? "border-brand-600 bg-brand-50"
                    : "border-surface-200 hover:border-surface-300"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedTier === t.key ? "border-brand-600" : "border-surface-300"
                }`}>
                  {selectedTier === t.key && <div className="w-2 h-2 rounded-full bg-brand-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-900">{t.label}</span>
                    {t.popular && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Star size={8} /> Beliebt
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-surface-500">{t.sub}</span>
                </div>
                <span className="text-sm font-bold text-brand-600">{t.price}</span>
              </button>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-2 mb-5">
            {PLANS.pro.features.slice(0, 6).map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-surface-700">
                <Check size={16} className="text-brand-600 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
            <p className="text-xs text-surface-400 pl-6">+ {PLANS.pro.features.length - 6} weitere Pro-Features</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-all flex items-center justify-center gap-2 shadow-md shadow-brand-600/20"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Weiterleitung zu Stripe...</>
              : <><Zap size={16} /> Jetzt upgraden</>
            }
          </button>
          <p className="text-center text-xs text-surface-400 mt-3">
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
