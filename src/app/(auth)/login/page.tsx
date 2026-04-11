"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, AtSign, Lock, Eye, EyeOff, ArrowRight, Loader2, Zap, Brain, Calendar, Shield, TrendingUp, Flame } from "lucide-react";
import { getEnabledProviders } from "@/lib/oauth-providers";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const enabledProviders = getEnabledProviders();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let email = identifier.trim();

    // If it doesn't look like an email, resolve username → email
    if (!email.includes("@")) {
      const { data, error: rpcError } = await supabase.rpc("get_email_by_username", {
        lookup_username: email,
      });
      if (rpcError || !data) {
        setError("Benutzername nicht gefunden");
        setLoading(false);
        return;
      }
      email = data;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Benutzername/E-Mail oder Passwort falsch"
          : error.message
      );
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleOAuth(provider: string) {
    setOauthLoading(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  }

  const features = [
    { icon: Zap, label: "Decision Engine", desc: "KI-gesteuerte Risiko-Analyse & Tagesplan" },
    { icon: Brain, label: "Lern-DNA", desc: "Dein persönliches 5D-Lernprofil" },
    { icon: Calendar, label: "Smart Schedule", desc: "7-Tage Stundenplan mit Kalenderdaten" },
    { icon: Shield, label: "Prüfungs-Intelligence", desc: "Notenprognosen & Schwächen-Analyse" },
    { icon: TrendingUp, label: "ECTS & Noten", desc: "Gewichteter Schnitt & Fortschritts-Tracking" },
    { icon: Flame, label: "Streak & Gamification", desc: "Tägliche Motivation durch Achievements" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Feature Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />

        <div className="relative z-10">
          <Link href="https://semetra.ch" className="inline-flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Gem size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">Semetra</span>
          </Link>

          <h2 className="text-3xl font-bold leading-tight mb-3">
            Dein Studium.<br />
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              Intelligent organisiert.
            </span>
          </h2>
          <p className="text-white/60 text-sm mb-10 max-w-sm leading-relaxed">
            50+ Tools, Decision Engine, KI-Assistent und alles was du für dein Studium brauchst — in einer App.
          </p>

          <div className="space-y-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-brand-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{label}</p>
                  <p className="text-xs text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8">
          <p className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Gebaut in der Schweiz
          </p>
        </div>
      </div>

      {/* RIGHT — Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:mb-10">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
              <Gem size={28} />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">Willkommen zurück</h1>
            <p className="text-surface-500 text-sm mt-1">Melde dich bei Semetra Workspace an</p>
          </div>

          <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
            {/* OAuth Buttons */}
            {enabledProviders.length > 0 && (
              <>
                <div className="space-y-2.5 mb-6">
                  {enabledProviders.map(({ id, label, icon: Icon, bg, text }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleOAuth(id)}
                      disabled={oauthLoading !== null}
                      className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${bg} ${text} disabled:opacity-50`}
                    >
                      {oauthLoading === id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Icon />
                      )}
                      Mit {label} anmelden
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-surface-200" />
                  <span className="text-xs text-surface-400 font-medium">oder mit E-Mail</span>
                  <div className="h-px flex-1 bg-surface-200" />
                </div>
              </>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Benutzername oder E-Mail</label>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type="text"
                    placeholder="max_muster oder deine@email.ch"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username email"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-surface-700">Passwort</label>
                  <Link href="/reset-password" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    Vergessen?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 shadow-sm shadow-brand-600/25"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Anmelden <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500 mt-5">
              Noch kein Konto?{" "}
              <Link href="/register" className="text-brand-600 font-semibold hover:text-brand-700 transition">
                Kostenlos registrieren
              </Link>
            </p>
          </div>

          {/* Footer (mobile) */}
          <p className="text-center text-[11px] text-surface-400 mt-6 lg:hidden">
            &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
