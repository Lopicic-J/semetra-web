"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { CheckCircle, XCircle, Zap, Check, ArrowLeft } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import { useProfile } from "@/lib/hooks/useProfile";
import Link from "next/link";

function UpgradeContent() {
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const { isPro, refetch } = useProfile();

  useEffect(() => {
    if (success) {
      // Refetch profile after successful payment (Stripe webhook may take a moment)
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Willkommen bei Semetra Pro! 🎉</h1>
        <p className="text-gray-500 mb-8 max-w-sm">
          Dein Upgrade war erfolgreich. Alle Pro-Features sind jetzt freigeschaltet.
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
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <XCircle className="text-gray-400" size={44} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upgrade abgebrochen</h1>
        <p className="text-gray-500 mb-8">Kein Problem — du kannst jederzeit upgraden.</p>
        <Link href="/dashboard" className="btn-secondary">Zurück zum Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Zap size={14} />
          Semetra Pro
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Hol das Beste aus deinem Studium heraus
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Upgrade auf Pro und schalte KI-Features, unbegrenzte Module, den FFHS Portal Import und Desktop-Sync frei.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {/* Free */}
        <div className="card border-2 border-gray-200">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Free</p>
            <p className="text-3xl font-bold text-gray-900">CHF 0</p>
            <p className="text-sm text-gray-400">für immer</p>
          </div>
          <div className="space-y-2 mb-6">
            {PLANS.free.features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={14} className="text-gray-400 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
            {PLANS.free.lockedFeatures.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-400 line-through">
                <Check size={14} className="text-gray-200 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {!isPro && (
            <div className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm text-center font-medium">
              Dein aktueller Plan
            </div>
          )}
        </div>

        {/* Pro */}
        <div className="card border-2 border-violet-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
            EMPFOHLEN
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-1">Pro</p>
            <p className="text-3xl font-bold text-gray-900">CHF 9.90</p>
            <p className="text-sm text-gray-400">pro Monat · jederzeit kündbar</p>
          </div>
          <div className="space-y-2 mb-6">
            {PLANS.pro.features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={14} className="text-violet-600 shrink-0" />
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
            <UpgradeButton />
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        Sichere Zahlung via Stripe · Schweizer Datenschutz · Keine versteckten Kosten
      </p>
    </div>
  );
}

function UpgradeButton() {
  return (
    <button
      onClick={async () => {
        const res = await fetch("/api/stripe/checkout", { method: "POST" });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      }}
      className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
    >
      <Zap size={16} />
      Jetzt upgraden
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
