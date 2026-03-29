"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 text-white text-3xl mb-4 shadow-lg">📖</div>
          <h1 className="text-2xl font-bold text-gray-900">Semetra</h1>
          <p className="text-gray-500 text-sm mt-1">Konto erstellen</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Registrieren</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input className="input" type="email" placeholder="deine@email.ch"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <input className="input" type="password" placeholder="Min. 8 Zeichen"
                value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? "Konto erstellen…" : "Konto erstellen"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Bereits registriert?{" "}
            <Link href="/login" className="text-violet-600 font-medium hover:underline">Anmelden</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
