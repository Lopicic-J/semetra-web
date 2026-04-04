"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, Globe } from "lucide-react";
import { getEnabledProviders } from "@/lib/oauth-providers";
import { COUNTRY_LIST, DEFAULT_COUNTRY, type CountryCode } from "@/lib/grading-systems";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const enabledProviders = getEnabledProviders();

  const pwStrength = (() => {
    if (password.length < 8) return 0;
    let s = 1;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwColors = ["bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-green-400"];
  const pwLabels = ["Schwach", "OK", "Gut", "Stark"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Passwort muss mind. 8 Zeichen haben"); return; }
    setLoading(true);
    setError(null);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { country },
      },
    });
    // Also save country to profile directly (in case trigger doesn't pass metadata)
    if (data?.user?.id) {
      await supabase.from("profiles").update({ country }).eq("id", data.user.id);
    }
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  }

  async function handleOAuth(provider: string) {
    setOauthLoading(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Bestätigungsmail gesendet</h1>
          <p className="text-surface-500 text-sm mb-6">
            Wir haben eine E-Mail an <strong className="text-surface-700">{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
          </p>
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700 text-sm">
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-brand-200/30 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
            <Gem size={28} />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Konto erstellen</h1>
          <p className="text-surface-500 text-sm mt-1">Starte kostenlos mit Semetra Workspace</p>
        </div>

        <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
          {/* OAuth — only shows if providers are enabled */}
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
                    {oauthLoading === id ? <Loader2 size={18} className="animate-spin" /> : <Icon />}
                    Mit {label} registrieren
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">E-Mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                  type="email"
                  placeholder="deine@email.ch"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Passwort</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                  type={showPw ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600" tabIndex={-1}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition ${i < pwStrength ? pwColors[pwStrength - 1] : "bg-surface-200"}`} />
                    ))}
                  </div>
                  <p className={`text-[10px] ${pwStrength >= 3 ? "text-green-600" : pwStrength >= 2 ? "text-amber-600" : "text-red-500"}`}>
                    {password.length < 8 ? "Mindestens 8 Zeichen" : pwLabels[pwStrength - 1]}
                  </p>
                </div>
              )}
            </div>

            {/* Country / Grading system */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Land / Notensystem</label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value as CountryCode)}
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition appearance-none"
                >
                  {COUNTRY_LIST.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-surface-400 mt-1">Bestimmt dein Notensystem. Kann sp&auml;ter ge&auml;ndert werden.</p>
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
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>Konto erstellen <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-5">
            Bereits registriert?{" "}
            <Link href="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition">
              Anmelden
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-surface-400 mt-6">
          &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra Workspace
        </p>
      </div>
    </div>
  );
}

