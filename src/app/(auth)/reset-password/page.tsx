"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Gem, Mail, ArrowLeft, Loader2, CheckCircle2, Shield, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />

        <div className="relative z-10">
          <Link href="https://semetra.ch" className="inline-flex items-center gap-2 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Gem size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">Semetra</span>
          </Link>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white dark:bg-surface-800/[0.06] border border-white/[0.08] flex items-center justify-center mb-6">
            <KeyRound size={36} className="text-brand-300" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Kein Stress.</h2>
          <p className="text-white/50 text-sm max-w-xs leading-relaxed">
            Passwort vergessen passiert jedem. In wenigen Sekunden hast du wieder Zugriff auf dein Studium.
          </p>

          <div className="mt-12 flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-surface-800/[0.04] border border-white/[0.06] max-w-xs">
            <Shield size={18} className="text-brand-300 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-white/80">Sicher & verschlüsselt</p>
              <p className="text-xs text-white/40 mt-0.5">Dein Reset-Link ist einmalig und läuft nach kurzer Zeit ab.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Gebaut in der Schweiz
          </p>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
              <Gem size={28} />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">Passwort zurücksetzen</h1>
            <p className="text-surface-500 text-sm mt-1">Wir senden dir einen Link per E-Mail</p>
          </div>

          <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="font-bold text-lg text-surface-900 mb-2">E-Mail gesendet</h2>
                <p className="text-sm text-surface-500 mb-4">
                  Falls ein Konto mit <strong className="text-surface-700">{email}</strong> existiert,
                  erhältst du eine E-Mail mit einem Link zum Zurücksetzen deines Passworts.
                </p>
                <p className="text-xs text-surface-400 mb-6">
                  Überprüfe auch deinen Spam-Ordner.
                </p>
                <Link href="/login" className="inline-flex items-center gap-2 text-brand-600 font-medium hover:text-brand-700 text-sm transition">
                  <ArrowLeft size={14} /> Zurück zum Login
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">E-Mail-Adresse</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                      <input
                        className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                        type="email"
                        placeholder="deine@email.ch"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                      />
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
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Link senden"}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition">
                    <ArrowLeft size={14} /> Zurück zum Login
                  </Link>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-[11px] text-surface-400 mt-6 lg:hidden">
            &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
