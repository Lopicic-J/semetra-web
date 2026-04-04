"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useTranslation, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "@/lib/i18n";
import { COUNTRY_LIST, type CountryCode } from "@/lib/grading-systems";
import Link from "next/link";
import {
  User,
  Mail,
  Globe,
  Languages,
  Calendar,
  Zap,
  Sparkles,
  Crown,
  CreditCard,
  ExternalLink,
  Settings,
  CheckCircle,
  Edit3,
  X,
  Save,
  Loader2,
} from "lucide-react";

interface AiUsage {
  used: number;
  addon_credits: number;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { profile, isPro, isLifetime, planTier, loading, refetch } = useProfile();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage>({ used: 0, addon_credits: 0 });
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email, created_at: data.user.created_at } : null);
    });
  }, [supabase]);

  // Load AI usage
  const loadAiUsage = useCallback(async () => {
    if (!profile?.id) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data } = await supabase
      .from("ai_usage")
      .select("used, addon_credits")
      .eq("user_id", profile.id)
      .eq("month", month)
      .single();
    if (data) setAiUsage(data);
  }, [supabase, profile?.id]);

  useEffect(() => { loadAiUsage(); }, [loadAiUsage]);

  // Compute plan info
  const planLabel = (() => {
    if (!profile) return "Free";
    if (isLifetime) return planTier === "full" ? "Lifetime Full" : "Lifetime Basic";
    if (isPro) return planTier === "full" ? "Pro Full" : "Pro Basic";
    return "Free";
  })();

  const planColor = isPro
    ? planTier === "full" ? "from-violet-600 to-brand-600" : "from-brand-600 to-brand-500"
    : "from-surface-400 to-surface-500";

  const subscriptionStatus = (() => {
    if (!profile || profile.plan === "free") return "Kein Abo";
    if (isLifetime) return "Lifetime — unbegrenzt";
    const s = profile.stripe_subscription_status;
    if (s === "active") return "Aktiv";
    if (s === "trialing") return "Testphase";
    if (s === "canceled" || s === "past_due") {
      if (profile.plan_expires_at) {
        const days = Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000);
        if (days > 0) return `Läuft aus in ${days} Tagen`;
        return "Abgelaufen";
      }
      return "Gekündigt";
    }
    return s || "—";
  })();

  const aiPool = (() => {
    if (!profile || profile.plan === "free") return 3;
    if (isLifetime) return planTier === "full" ? 20 : 0;
    return planTier === "full" ? 100 : 10;
  })();

  const totalPool = aiPool + aiUsage.addon_credits;
  const aiPercent = totalPool > 0 ? Math.min(100, (aiUsage.used / totalPool) * 100) : 0;
  const aiRemaining = Math.max(0, totalPool - aiUsage.used);

  // Name editing
  async function saveName() {
    if (!profile?.id || !nameValue.trim()) return;
    setSavingName(true);
    await supabase.from("profiles").update({ full_name: nameValue.trim() }).eq("id", profile.id);
    await refetch();
    setEditingName(false);
    setSavingName(false);
  }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "—";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-5 mb-8">
        <div className={`w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${planColor} text-white flex items-center justify-center text-2xl font-bold shadow-lg`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {!editingName ? (
              <>
                <h1 className="text-2xl font-bold text-surface-900">{displayName}</h1>
                <button
                  onClick={() => { setNameValue(profile?.full_name || ""); setEditingName(true); }}
                  className="text-surface-400 hover:text-brand-600 transition"
                >
                  <Edit3 size={14} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  placeholder="Dein Name"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && saveName()}
                />
                <button onClick={saveName} disabled={savingName} className="text-brand-600 hover:text-brand-500">
                  {savingName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
                <button onClick={() => setEditingName(false)} className="text-surface-400 hover:text-surface-600">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <p className="text-surface-500 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              isPro
                ? planTier === "full"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-brand-100 text-brand-700"
                : "bg-surface-100 text-surface-500"
            }`}>
              {isLifetime && <Crown size={10} />}
              {isPro && planTier === "full" && <Sparkles size={10} />}
              {planLabel}
            </span>
            <span className="text-xs text-surface-400">
              Mitglied seit {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {/* Plan Card */}
        <div className="bg-surface-900 text-white rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-semibold uppercase tracking-wide mb-3">
              <CreditCard size={12} />
              Dein Abo
            </div>
            <p className="text-xl font-bold mb-1">{planLabel}</p>
            <p className="text-sm text-white/60 mb-4">{subscriptionStatus}</p>

            {isPro && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["Unbegrenzte Module", "Sync", "Themes", ...(planTier === "full" ? ["KI-Assistent"] : [])].map(f => (
                  <span key={f} className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium">{f}</span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {!isPro ? (
                <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white text-surface-900 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-surface-100 transition">
                  <Zap size={12} /> Upgrade auf Pro
                </Link>
              ) : (
                <>
                  <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white text-surface-900 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-surface-100 transition">
                    Abo verwalten
                  </Link>
                  <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/20 transition">
                    <Sparkles size={12} /> Add-on
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Usage Card */}
        <div className="bg-white rounded-2xl border border-surface-200 p-5">
          <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-3">
            <Sparkles size={12} />
            KI-Nutzung (Monat)
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-surface-900">{aiUsage.used}</span>
            <span className="text-sm text-surface-400 font-medium">/ {totalPool}</span>
          </div>

          <div className="h-2 bg-surface-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500"
              style={{ width: `${aiPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-surface-400">
            <span>Verbraucht</span>
            <span>{aiRemaining} verbleibend</span>
          </div>

          {aiUsage.addon_credits > 0 && (
            <p className="text-xs text-violet-600 font-medium mt-2">
              + {aiUsage.addon_credits} Add-on-Credits inkludiert
            </p>
          )}

          {totalPool === 0 && isPro && (
            <p className="text-xs text-surface-400 mt-2">
              Dein Lifetime Basic Plan enthält keine KI-Requests.{" "}
              <Link href="/upgrade" className="text-violet-600 font-medium">Add-on kaufen</Link>
            </p>
          )}
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5 mb-4">
        <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-4">
          <User size={12} />
          Konto-Details
        </div>

        <div className="space-y-0">
          <DetailRow icon={<Mail size={14} />} label="E-Mail" value={user?.email || "—"} />
          <DetailRow icon={<Globe size={14} />} label="Land" value={
            COUNTRY_LIST.find(c => c.code === profile?.country)?.name || profile?.country || "—"
          } />
          <DetailRow icon={<Languages size={14} />} label="Sprache" value={
            profile?.language ? `${LOCALE_FLAGS[profile.language as Locale] || ""} ${LOCALE_LABELS[profile.language as Locale] || profile.language}` : "Deutsch"
          } />
          <DetailRow icon={<Calendar size={14} />} label="Mitglied seit" value={memberSince} />
          {profile?.stripe_customer_id && (
            <DetailRow icon={<CreditCard size={14} />} label="Stripe Kunde" value={profile.stripe_customer_id} />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-4">
          Schnellzugriff
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/settings" icon={<Settings size={14} />} label="Einstellungen" />
          <QuickLink href="/upgrade" icon={<Zap size={14} />} label="Upgrade / Add-on" />
          <QuickLink href="/dashboard" icon={<ExternalLink size={14} />} label="Dashboard" />
          <a
            href="https://semetra.ch/profil.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition"
          >
            <Globe size={14} /> Profil auf semetra.ch
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
      <div className="flex items-center gap-2.5 text-surface-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-surface-900">{value}</span>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition"
    >
      {icon} {label}
    </Link>
  );
}
