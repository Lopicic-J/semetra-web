"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Gem, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, AtSign,
  Zap, Brain, Calendar, Shield, TrendingUp, Flame,
} from "lucide-react";
import { getEnabledProviders } from "@/lib/oauth-providers";
import { COUNTRY_LIST, DEFAULT_COUNTRY, type CountryCode } from "@/lib/grading-systems";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
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

  // ── Username validation ────────────────────────────────────────────────
  const isValidUsername = (u: string) => /^[a-z0-9_-]{3,30}$/.test(u);
  const usernameValid = isValidUsername(username);

  const checkUsername = useCallback(async (u: string) => {
    if (!isValidUsername(u)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const { data } = await supabase.rpc("get_email_by_username", { lookup_username: u });
    setUsernameStatus(data ? "taken" : "available");
  }, [supabase]);

  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    const timer = setTimeout(() => checkUsername(username.toLowerCase()), 400);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  function handleUsernameChange(v: string) {
    setUsername(v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30));
  }

  // ── Password strength ──────────────────────────────────────────────────
  function calcStrength(pw: string): number {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }
  const pwStrength = calcStrength(password);
  const pwColors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-green-500"];
  const pwLabels = ["Schwach", "OK", "Gut", "Stark"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameValid) {
      setError("Benutzername muss 3\u201330 Zeichen lang sein (Kleinbuchstaben, Zahlen, _ oder -)");
      return;
    }
    if (usernameStatus === "taken") {
      setError("Dieser Benutzername ist bereits vergeben");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mind. 8 Zeichen haben");
      return;
    }
    setLoading(true);
    setError(null);

    const { data: existingEmail } = await supabase.rpc("get_email_by_username", { lookup_username: username });
    if (existingEmail) {
      setError("Dieser Benutzername ist bereits vergeben");
      setLoading(false);
      return;
    }

    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { country },
      },
    });

    if (data?.user?.id) {
      await supabase.from("profiles").update({
        country,
        username,
      }).eq("id", data.user.id);
    }

    if (signUpError) {
      setError(signUpError.message);
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

  const features = [
    { icon: Zap, label: "Decision Engine", desc: "KI-gesteuerte Risiko-Analyse" },
    { icon: Brain, label: "Lern-DNA", desc: "Dein 5D-Lernprofil" },
    { icon: Calendar, label: "Smart Schedule", desc: "7-Tage Stundenplan" },
    { icon: Shield, label: "Prüfungs-Intelligence", desc: "Notenprognosen" },
    { icon: TrendingUp, label: "ECTS & Noten", desc: "Fortschritts-Tracking" },
    { icon: Flame, label: "Streak & Gamification", desc: "Tägliche Motivation" },
  ];

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
            Bestätigungs-E-Mail gesendet
          </h1>
          <p className="text-surface-500 text-sm mb-6">
            Wir haben einen Bestätigungs-Link an{" "}
            <strong className="text-surface-700 dark:text-surface-200">{email}</strong> gesendet.
            Klicke den Link, um dein Konto zu aktivieren.
          </p>
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700 text-sm">
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Feature Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
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
            Starte jetzt.<br />
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              Kostenlos &amp; sofort.
            </span>
          </h2>
          <p className="text-white/60 text-sm mb-10 max-w-sm leading-relaxed">
            50+ Tools, Decision Engine, KI-Assistent — alles was du brauchst, um dein Studium zu meistern.
          </p>

          <div className="space-y-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-surface-800/[0.04] border border-white/[0.06] backdrop-blur-sm">
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

      {/* RIGHT — Register Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-md py-6">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:mb-10">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
              <Gem size={28} />
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Konto erstellen</h1>
            <p className="text-surface-500 text-sm mt-1">Starte kostenlos mit Semetra</p>
          </div>

          <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 dark:shadow-black/50 border border-surface-200/60 p-6 sm:p-8">
            {/* OAuth */}
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
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Benutzername</label>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type="text"
                    placeholder="z. B. max_muster"
                    value={username}
                    onChange={e => handleUsernameChange(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                  />
                </div>
                <p className={`text-[10px] mt-1 ${
                  usernameStatus === "available" ? "text-green-600 dark:text-green-400" :
                  usernameStatus === "taken" ? "text-red-500 dark:text-red-400" :
                  username.length > 0 && !usernameValid ? "text-red-500 dark:text-red-400" :
                  "text-surface-400"
                }`}>
                  {usernameStatus === "checking" ? "Wird geprüft..." :
                   usernameStatus === "available" ? "\u2713 Verfügbar" :
                   usernameStatus === "taken" ? "\u2717 Bereits vergeben" :
                   username.length > 0 && !usernameValid ? "3\u201330 Zeichen: Kleinbuchstaben, Zahlen, _ und -" :
                   "Dein eindeutiger Benutzername zum Anmelden"}
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">E-Mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type="email"
                    placeholder="deine@email.ch"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Passwort</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type={showPw ? "text" : "password"}
                    placeholder="Mindestens 8 Zeichen"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-400"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition ${i < pwStrength ? pwColors[pwStrength - 1] : "bg-surface-200"}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] ${pwStrength >= 3 ? "text-green-600 dark:text-green-400" : pwStrength >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
                      {password.length < 8 ? "Mindestens 8 Zeichen" : pwLabels[pwStrength - 1]}
                    </p>
                  </div>
                )}
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Land</label>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value as CountryCode)}
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                >
                  {COUNTRY_LIST.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] mt-1 text-surface-400">
                  Bestimmt Standard-Benotungssystem und Sprache.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !usernameValid || usernameStatus === "taken" || password.length < 8}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold py-2.5 rounded-xl transition shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Konto erstellen"}
              </button>
            </form>

            <p className="text-xs text-center text-surface-500 mt-6">
              Bereits ein Konto?{" "}
              <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                Anmelden
              </Link>
            </p>

            <p className="text-[10px] text-center text-surface-400 mt-4 leading-relaxed">
              Mit der Registrierung akzeptierst du unsere{" "}
              <a href="https://semetra.ch/agb.html" className="underline hover:text-surface-600">AGB</a>
              {" "}und{" "}
              <a href="https://semetra.ch/datenschutz.html" className="underline hover:text-surface-600">Datenschutzerklärung</a>.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/30 border border-surface-200 text-[10px] text-surface-500 text-center">
              Du bist Dozent:in oder vertrittst eine Institution? Kontaktiere{" "}
              <a href="mailto:support@semetra.ch?subject=Institutions-Account" className="text-brand-600 hover:underline">
                support@semetra.ch
              </a>
              {" "}für einen verifizierten Zugang.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
