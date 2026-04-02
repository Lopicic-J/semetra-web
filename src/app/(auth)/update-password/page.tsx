"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

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

  // After /auth/callback exchanges the recovery code, the user arrives here authenticated
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSessionReady(true);
      } else {
        // Small delay in case cookies are still being set
        setTimeout(async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) setSessionReady(true);
          else setNoSession(true);
        }, 1500);
      }
    };
    checkSession();
  }, [supabase]);

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

  if (noSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 mb-4">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Link ungültig oder abgelaufen</h1>
          <p className="text-surface-500 text-sm mb-6">
            Bitte fordere einen neuen Link zum Zurücksetzen deines Passworts an.
          </p>
          <Link href="/reset-password"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-4">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Passwort aktualisiert</h1>
          <p className="text-surface-500 text-sm">Du wirst zum Dashboard weitergeleitet...</p>
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
          <h1 className="text-2xl font-bold text-surface-900">Neues Passwort setzen</h1>
          <p className="text-surface-500 text-sm mt-1">Wähle ein starkes neues Passwort</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
          {!sessionReady ? (
            <div className="text-center py-6">
              <Loader2 size={24} className="animate-spin text-brand-500 mx-auto mb-3" />
              <p className="text-sm text-surface-500">Sitzung wird überprüft...</p>
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
      </div>
    </div>
  );
}
