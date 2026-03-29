"use client";
import { useState } from "react";
import { Lock, Zap, X, Check, Loader2 } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import type { ProFeature } from "@/lib/gates";
import { PRO_FEATURES } from "@/lib/gates";

interface ProGateProps {
  feature: ProFeature;
  isPro: boolean;
  children: React.ReactNode;
  /** If true, renders children grayed out with a lock overlay instead of hiding them */
  overlay?: boolean;
}

export function ProGate({ feature, isPro, children, overlay = false }: ProGateProps) {
  const [showModal, setShowModal] = useState(false);

  if (isPro) return <>{children}</>;

  if (overlay) {
    return (
      <>
        <div className="relative">
          <div className="opacity-40 pointer-events-none select-none">{children}</div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl cursor-pointer"
            onClick={() => setShowModal(true)}
          >
            <div className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
              <Lock size={14} />
              Pro-Feature
            </div>
          </div>
        </div>
        {showModal && <UpgradeModal feature={feature} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="flex flex-col items-center justify-center py-20 text-center cursor-pointer group"
      >
        <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
          <Lock className="text-violet-500" size={32} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{PRO_FEATURES[feature]}</h2>
        <p className="text-gray-500 text-sm mb-5">
          Dieses Feature ist nur für Pro-Nutzer verfügbar.
        </p>
        <span className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors">
          <Zap size={15} />
          Jetzt upgraden — CHF 9.90/Monat
        </span>
      </div>
      {showModal && <UpgradeModal feature={feature} onClose={() => setShowModal(false)} />}
    </>
  );
}

export function UpgradeModal({ feature, onClose }: { feature?: ProFeature; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
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
          <div className="mt-4">
            <span className="text-4xl font-bold">CHF 9.90</span>
            <span className="text-violet-300 ml-1">/ Monat</span>
          </div>
        </div>

        {/* Features */}
        <div className="p-6">
          <div className="space-y-2.5 mb-6">
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
              ? <><Loader2 size={16} className="animate-spin" /> Weiterleitung zu Stripe…</>
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
