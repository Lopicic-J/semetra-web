"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSessionReady(true);
      } else {
        setTimeout(async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) setSessionReady(true);
          else setNoSession(true);
        }, 1500);
      }
    };
    checkSession();
  }, [supabase]);

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
    if (password !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  // Error state — link invalid/expired
  if (noSession) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-center items-center bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
            <AlertTriangle size={36} className="text-amber-300" />
          </div>
          <p className="relative z-10 text-white/50 text-sm text-center max-w-xs">Reset-Links laufen aus Sicherheitsgründen nach kurzer Zeit ab.</p>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-4">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Link ungültig oder abgelaufen</h1>
            <p className="text-surface-500 text-sm mb-6">
              Bitte fordere einen neuen Link zum Zurücksetzen deines Passworts an.
            </p>
            <Link href="/reset-password"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm shadow-brand-600/25">
              Neuen Link anfordern
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-center items-center bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6">
            <CheckCircle2 size={36} className="text-green-400" />
          </div>
          <h2 className="relative z-10 text-xl font-bold mb-2">Geschafft!</h2>
          <p className="relative z-10 text-white/50 text-sm text-center max-w-xs">Dein neues Passwort ist aktiv. Weiter gehts zum Dashboard.</p>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Passwort aktualisiert</h1>
            <p className="text-surface-500 text-sm">Du wirst zum Dashboard weitergeleitet...</p>
            <Loader2 size={20} className="animate-spin text-brand-500 mx-auto mt-4" />
          </div>
        </div>
      </div>
    );
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
          <div className="w-20 h-20 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-6">
            <ShieldCheck size={36} className="text-brand-300" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Fast geschafft.</h2>
          <p className="text-white/50 text-sm max-w-xs leading-relaxed">
            Wähle ein starkes neues Passwort und du bist wieder startklar.
          </p>

          <div className="mt-10 space-y-3 w-full max-w-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-xs text-white/50">Mindestens 8 Zeichen</p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-xs text-white/50">Gross- und Kleinbuchstaben</p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-xs text-white/50">Zahlen und Sonderzeichen</p>
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
            <h1 className="text-2xl font-bold text-surface-900">Neues Passwort setzen</h1>
            <p className="text-surface-500 text-sm mt-1">Wähle ein starkes neues Passwort</p>
          </div>

          <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
            {!sessionReady ? (
              <div className="text-center py-8">
                <Loader2 size={28} className="animate-spin text-brand-500 mx-auto mb-4" />
                <p className="text-sm text-surface-500">Sitzung wird überprüft...</p>
                <p className="text-xs text-surface-400 mt-1">Einen Moment bitte</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Neues Passwort</label>
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
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600" tabIndex={-1}>
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
                      <p className={`text-[10px] ${pwStrength >= 3 ? "text-green-600" : pwStrength >= 2 ? "text-amber-600" : "text-red-500"}`}>
                        {password.length < 8 ? "Mindestens 8 Zeichen" : pwLabels[pwStrength - 1]}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Passwort bestätigen</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                      type={showPw ? "text" : "password"}
                      placeholder="Passwort wiederholen"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-[11px] text-red-500 mt-1">Passwörter stimmen nicht überein</p>
                  )}
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirm}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 shadow-sm shadow-brand-600/25"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Passwort aktualisieren"}
                </button>
              </form>
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
