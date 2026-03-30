"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, User, Bell, Palette, Shield, LogOut, Zap, CreditCard, CheckCircle, Monitor, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/hooks/useProfile";
import Link from "next/link";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, isPro } = useProfile();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email, created_at: data.user.created_at } : null);
    });
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const tabs = [
    { id: "account",       label: "Konto",              icon: User },
    { id: "plan",          label: "Abo & Lizenz",        icon: CreditCard },
    { id: "appearance",    label: "Darstellung",         icon: Palette },
    { id: "notifications", label: "Benachrichtigungen",  icon: Bell },
    { id: "privacy",       label: "Datenschutz",         icon: Shield },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-500 text-sm mt-0.5">App & Konto verwalten</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === t.id ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors mt-4">
            <LogOut size={16} />
            Abmelden
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "account"       && <AccountTab user={user} />}
          {activeTab === "plan"          && <PlanTab isPro={isPro} profile={profile} />}
          {activeTab === "appearance"    && <AppearanceTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "privacy"       && <PrivacyTab />}
        </div>
      </div>
    </div>
  );
}

function AccountTab({ user }: { user: { email?: string; created_at?: string } | null }) {
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setMsg({ type: "error", text: "Passwörter stimmen nicht überein." }); return; }
    if (newPassword.length < 8) { setMsg({ type: "error", text: "Mindestens 8 Zeichen erforderlich." }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) setMsg({ type: "error", text: error.message });
    else { setMsg({ type: "success", text: "Passwort erfolgreich geändert." }); setNewPassword(""); setConfirmPassword(""); }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Kontoinformationen</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">E-Mail</label>
            <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2.5 rounded-xl">{user?.email ?? "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Konto erstellt</label>
            <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2.5 rounded-xl">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Passwort ändern</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 Zeichen" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
            <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Wiederholen…" />
          </div>
          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Speichern…" : "Passwort ändern"}
          </button>
        </form>
      </div>

      <div className="card border-red-100">
        <h2 className="font-semibold text-red-700 mb-2">Gefahrenzone</h2>
        <p className="text-sm text-gray-500 mb-3">Das Löschen deines Kontos ist permanent und kann nicht rückgängig gemacht werden.</p>
        <button className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
          Konto löschen
        </button>
      </div>
    </div>
  );
}

function PlanTab({ isPro, profile }: { isPro: boolean; profile: { stripe_subscription_status?: string | null; plan_expires_at?: string | null } | null }) {
  const [loading, setLoading] = useState(false);
  const DESKTOP_PRO_LINK = "https://buy.stripe.com/3cIeVf54860AcOC2M3fYY03";

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch {}
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* Web Abo */}
      <div className={`card border-2 ${isPro ? "border-violet-500" : "border-gray-200"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Web-App Abo</h2>
            <p className="text-xs text-gray-400 mt-0.5">Monatlich oder jährlich kündbar</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPro ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>
            {isPro ? "PRO" : "FREE"}
          </span>
        </div>

        {isPro ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle size={15} className="text-green-500" />
              Abo aktiv · {profile?.stripe_subscription_status === "trialing" ? "Testphase" : "bezahlt"}
            </div>
            {profile?.plan_expires_at && (
              <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
                Abo läuft ab am {new Date(profile.plan_expires_at).toLocaleDateString("de-CH")}
              </div>
            )}
            <button
              onClick={handlePortal}
              disabled={loading}
              className="btn-secondary gap-2 mt-3"
            >
              <CreditCard size={14} />
              {loading ? "Öffne Stripe…" : "Abo verwalten / kündigen"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Du nutzt Semetra Free. Upgrade auf Pro für KI-Features, unbegrenzte Module und Sync.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/upgrade" className="btn-primary gap-2 inline-flex">
                <Zap size={14} />
                Pläne vergleichen & upgraden
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Pro Einmalkauf */}
      <div className="card border-2 border-emerald-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Monitor size={18} className="text-emerald-600" />
              Desktop Pro
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Einmalkauf · Dauerhaft gültig · Kein Abo</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
            CHF 49,90
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Einmalig zahlen, dauerhaft Pro-Features in der Desktop-App nutzen. Der Lizenzschlüssel wird per E-Mail zugestellt.
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-sm text-gray-600 mb-4">
          {["Unbegrenzte Module & Noten", "KI-Studien-Coach", "FH-Voreinstellungen", "KI-Karteikarten"].map(f => (
            <div key={f} className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <a
          href={DESKTOP_PRO_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Monitor size={15} />
          Desktop Pro kaufen
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Desktop ↔ Web Sync */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Desktop ↔ Web Sync</h2>
        <p className="text-sm text-gray-600 mb-2">
          Melde dich in der Desktop-App mit denselben Zugangsdaten an (E-Mail + Passwort). Deine Daten werden automatisch synchronisiert — über Supabase, in Echtzeit.
        </p>
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 font-mono">
          Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—"}
        </div>
        {!isPro && (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl mt-3">
            Desktop-Sync erfordert ein aktives Semetra Pro Abo oder Desktop Pro Lizenz.
          </p>
        )}
      </div>
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Darstellung</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Farbschema</label>
          <div className="flex gap-3">
            {[
              { id: "light", label: "Hell", emoji: "☀️" },
              { id: "dark", label: "Dunkel", emoji: "🌙" },
              { id: "system", label: "System", emoji: "💻" },
            ].map(t => (
              <button key={t.id} className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium">
                <span className="text-xl">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Akzentfarbe</label>
          <div className="flex gap-2">
            {["#6d28d9","#2563eb","#059669","#dc2626","#d97706"].map(c => (
              <button key={c} className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform" style={{ background: c }} />
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400">Weitere Darstellungsoptionen folgen in einem Update.</p>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [settings, setSettings] = useState({
    exam_reminder: true,
    task_deadline: true,
    weekly_summary: false,
    push: false,
  });

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Benachrichtigungen</h2>
      <div className="space-y-4">
        {[
          { key: "exam_reminder" as const, label: "Prüfungserinnerungen", description: "7 und 1 Tag vor einer Prüfung" },
          { key: "task_deadline" as const, label: "Aufgaben-Deadlines", description: "1 Tag vor Fälligkeit" },
          { key: "weekly_summary" as const, label: "Wochenzusammenfassung", description: "Jeden Montag eine Übersicht" },
          { key: "push" as const, label: "Push-Benachrichtigungen", description: "Browser-Benachrichtigungen aktivieren" },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400">{item.description}</p>
            </div>
            <button onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings[item.key] ? "bg-violet-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${settings[item.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
        <p className="text-xs text-gray-400 pt-2">Einstellungen werden lokal gespeichert. Cloud-Sync kommt mit Semetra Pro.</p>
      </div>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Datenschutz</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Semetra speichert deine Daten sicher in der Cloud über Supabase (PostgreSQL). Alle Daten sind mit Row Level Security (RLS) geschützt — nur du hast Zugriff auf deine eigenen Daten.
        </p>
      </div>
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Daten exportieren</h2>
        <p className="text-sm text-gray-500 mb-3">Exportiere alle deine Daten als JSON- oder CSV-Datei.</p>
        <button className="btn-secondary gap-2">📥 Daten exportieren (demnächst)</button>
      </div>
    </div>
  );
}
