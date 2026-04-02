"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { getEnabledProviders } from "@/lib/oauth-providers";

export default function LoginPage() {
  const [email, setEmail] = useState("");
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-Mail oder Passwort falsch"
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-brand-200/30 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white mb-4 shadow-lg shadow-brand-500/25">
            <Gem size={28} />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Willkommen zurück</h1>
          <p className="text-surface-500 text-sm mt-1">Melde dich bei Semetra an</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
          {/* OAuth Buttons — only shows if providers are enabled */}
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

        {/* Footer */}
        <p className="text-center text-[11px] text-surface-400 mt-6">
          &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra
        </p>
      </div>
    </div>
  );
}

