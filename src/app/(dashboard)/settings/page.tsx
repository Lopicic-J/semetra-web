"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, User, Bell, Palette, Shield, LogOut, Zap, CreditCard, CheckCircle, Monitor, ExternalLink, Download, Loader2, FileJson, HardDrive, Database } from "lucide-react";
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
        <h1 className="text-2xl font-bold text-surface-900">Einstellungen</h1>
        <p className="text-surface-500 text-sm mt-0.5">App & Konto verwalten</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === t.id ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100"}`}>
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-surface-500 hover:bg-red-50 hover:text-red-600 transition-colors mt-4">
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
        <h2 className="font-semibold text-surface-900 mb-4">Kontoinformationen</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">E-Mail</label>
            <p className="text-sm text-surface-800 bg-surface-50 px-3 py-2.5 rounded-xl">{user?.email ?? "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">Konto erstellt</label>
            <p className="text-sm text-surface-800 bg-surface-50 px-3 py-2.5 rounded-xl">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-4">Passwort ändern</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Neues Passwort</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 Zeichen" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Passwort bestätigen</label>
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
        <p className="text-sm text-surface-500 mb-3">Das Löschen deines Kontos ist permanent und kann nicht rückgängig gemacht werden.</p>
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

  // Calculate subscription remaining time
  const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const now = new Date();
  let remainingDays = 0;
  let remainingLabel = "";
  let aboExpired = false;

  if (expiresAt) {
    const diffMs = expiresAt.getTime() - now.getTime();
    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    aboExpired = remainingDays <= 0;

    if (aboExpired) {
      remainingLabel = "Abgelaufen";
    } else if (remainingDays > 365) {
      const years = Math.floor(remainingDays / 365);
      const months = Math.floor((remainingDays % 365) / 30);
      remainingLabel = months > 0 ? `${years}J ${months}M` : `${years} Jahr${years > 1 ? "e" : ""}`;
    } else if (remainingDays > 30) {
      const months = Math.floor(remainingDays / 30);
      const days = remainingDays % 30;
      remainingLabel = days > 0 ? `${months}M ${days}T` : `${months} Monat${months > 1 ? "e" : ""}`;
    } else {
      remainingLabel = `${remainingDays} Tag${remainingDays !== 1 ? "e" : ""}`;
    }
  }

  // Determine status styling
  const isActive = profile?.stripe_subscription_status === "active" || profile?.stripe_subscription_status === "trialing";
  const isCanceling = expiresAt && isActive && remainingDays > 0 && remainingDays <= 30;

  return (
    <div className="space-y-5">
      {/* Web Abo */}
      <div className={`card border-2 ${isPro ? "border-brand-500" : "border-surface-200"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-surface-900">Web-App Abo</h2>
            <p className="text-xs text-surface-400 mt-0.5">Monatlich oder jährlich kündbar</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPro ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-surface-500"}`}>
            {isPro ? "PRO" : "FREE"}
          </span>
        </div>

        {isPro ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-surface-600">
              <CheckCircle size={15} className="text-green-500" />
              Abo aktiv · {profile?.stripe_subscription_status === "trialing" ? "Testphase" : "bezahlt"}
            </div>

            {/* Subscription duration card */}
            {expiresAt && (
              <div className={`rounded-xl p-4 ${
                aboExpired ? "bg-red-50 border border-red-200" :
                isCanceling ? "bg-amber-50 border border-amber-200" :
                "bg-brand-50 border border-brand-100"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">Laufzeit</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    aboExpired ? "bg-red-100 text-red-700" :
                    isCanceling ? "bg-amber-100 text-amber-700" :
                    "bg-brand-100 text-brand-700"
                  }`}>
                    {aboExpired ? "Abgelaufen" : `Noch ${remainingLabel}`}
                  </span>
                </div>

                {/* Progress bar */}
                {!aboExpired && (
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCanceling ? "bg-amber-400" : "bg-brand-500"
                      }`}
                      style={{ width: `${Math.max(5, 100 - Math.min(100, (remainingDays / 365) * 100))}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className={aboExpired ? "text-red-600" : "text-surface-500"}>
                    {aboExpired
                      ? `Abgelaufen am ${expiresAt.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}`
                      : `Gültig bis ${expiresAt.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}`
                    }
                  </span>
                  {!aboExpired && (
                    <span className="text-surface-400">{remainingDays} Tage</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handlePortal}
              disabled={loading}
              className="btn-secondary gap-2"
            >
              <CreditCard size={14} />
              {loading ? "Öffne Stripe…" : "Abo verwalten / kündigen"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-surface-500 mb-3">
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
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <Monitor size={18} className="text-emerald-600" />
              Desktop Pro
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">Einmalkauf · Dauerhaft gültig · Kein Abo</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
            CHF 49,90
          </span>
        </div>
        <p className="text-sm text-surface-600 mb-3">
          Einmalig zahlen, dauerhaft Pro-Features in der Desktop-App nutzen. Der Lizenzschlüssel wird per E-Mail zugestellt.
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-sm text-surface-600 mb-4">
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
        <h2 className="font-semibold text-surface-900 mb-3">Desktop ↔ Web Sync</h2>
        <p className="text-sm text-surface-600 mb-2">
          Melde dich in der Desktop-App mit denselben Zugangsdaten an (E-Mail + Passwort). Deine Daten werden automatisch synchronisiert — über Supabase, in Echtzeit.
        </p>
        <div className="bg-surface-50 rounded-xl p-3 text-xs text-surface-500 font-mono">
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
      <h2 className="font-semibold text-surface-900 mb-4">Darstellung</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">Farbschema</label>
          <div className="flex gap-3">
            {[
              { id: "light", label: "Hell", emoji: "☀️" },
              { id: "dark", label: "Dunkel", emoji: "🌙" },
              { id: "system", label: "System", emoji: "💻" },
            ].map(t => (
              <button key={t.id} className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium">
                <span className="text-xl">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Akzentfarbe</label>
          <div className="flex gap-2">
            {["#6d28d9","#2563eb","#059669","#dc2626","#d97706"].map(c => (
              <button key={c} className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform" style={{ background: c }} />
            ))}
          </div>
        </div>
        <p className="text-xs text-surface-400">Weitere Darstellungsoptionen folgen in einem Update.</p>
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
      <h2 className="font-semibold text-surface-900 mb-4">Benachrichtigungen</h2>
      <div className="space-y-4">
        {[
          { key: "exam_reminder" as const, label: "Prüfungserinnerungen", description: "7 und 1 Tag vor einer Prüfung" },
          { key: "task_deadline" as const, label: "Aufgaben-Deadlines", description: "1 Tag vor Fälligkeit" },
          { key: "weekly_summary" as const, label: "Wochenzusammenfassung", description: "Jeden Montag eine Übersicht" },
          { key: "push" as const, label: "Push-Benachrichtigungen", description: "Browser-Benachrichtigungen aktivieren" },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-surface-800">{item.label}</p>
              <p className="text-xs text-surface-400">{item.description}</p>
            </div>
            <button onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings[item.key] ? "bg-brand-600" : "bg-surface-200"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${settings[item.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
        <p className="text-xs text-surface-400 pt-2">Einstellungen werden lokal gespeichert. Cloud-Sync kommt mit Semetra Pro.</p>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const supabase = createClient();
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"desktop" | "json">("desktop");
  const [exportResult, setExportResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchAllData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const [modules, tasks, events, grades, topics, timeLogs, stundenplan, taskAtt, examAtt] = await Promise.all([
      supabase.from("modules").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("*").eq("user_id", user.id),
      supabase.from("events").select("*").eq("user_id", user.id),
      supabase.from("grades").select("*").eq("user_id", user.id),
      supabase.from("topics").select("*").eq("user_id", user.id),
      supabase.from("time_logs").select("*").eq("user_id", user.id),
      supabase.from("stundenplan").select("*").eq("user_id", user.id),
      supabase.from("task_attachments").select("*").eq("user_id", user.id),
      supabase.from("exam_attachments").select("*").eq("user_id", user.id),
    ]);

    return {
      modules: modules.data ?? [],
      tasks: tasks.data ?? [],
      events: events.data ?? [],
      grades: grades.data ?? [],
      topics: topics.data ?? [],
      time_logs: timeLogs.data ?? [],
      stundenplan: stundenplan.data ?? [],
      task_attachments: taskAtt.data ?? [],
      exam_attachments: examAtt.data ?? [],
    };
  }

  /** Map web data → desktop-compatible format */
  function toDesktopFormat(data: Awaited<ReturnType<typeof fetchAllData>>) {
    // Build UUID → integer ID mapping for modules (desktop uses integer PKs)
    const moduleIdMap = new Map<string, number>();
    data.modules.forEach((m, i) => moduleIdMap.set(m.id, i + 1));

    const taskIdMap = new Map<string, number>();
    data.tasks.forEach((t, i) => taskIdMap.set(t.id, i + 1));

    return {
      _meta: {
        format: "semetra-desktop-import",
        version: 1,
        exported_at: new Date().toISOString(),
        source: "semetra-web",
      },
      modules: data.modules.map((m, i) => ({
        id: i + 1,
        name: m.name,
        code: m.code ?? "",
        semester: m.semester ?? "",
        ects: m.ects ?? 0,
        lecturer: m.professor ?? "",
        link: m.link ?? "",
        status: m.status ?? "planned",
        exam_date: m.exam_date ?? "",
        weighting: m.weighting ?? 1.0,
        github_link: m.github_link ?? "",
        sharepoint_link: m.sharepoint_link ?? "",
        literature_links: m.literature_links ?? "",
        notes_link: m.notes_link ?? "",
        module_type: m.module_type ?? "pflicht",
        in_plan: m.in_plan ? 1 : 0,
        target_grade: m.target_grade ?? null,
      })),
      tasks: data.tasks.map((t, i) => ({
        id: i + 1,
        module_id: t.module_id ? (moduleIdMap.get(t.module_id) ?? 0) : 0,
        title: t.title,
        priority: t.priority === "high" ? "High" : t.priority === "critical" ? "Critical" : t.priority === "low" ? "Low" : "Medium",
        status: t.status === "done" ? "Done" : t.status === "in_progress" ? "In Progress" : "Open",
        due_date: t.due_date ?? "",
        notes: t.notes ?? "",
        created_at: t.created_at,
        updated_at: t.updated_at ?? t.created_at,
      })),
      events: data.events.map((e, i) => ({
        id: i + 1,
        module_id: null,
        title: e.title,
        kind: e.event_type === "exam" ? "custom" : (e.event_type ?? "custom"),
        start_date: e.start_dt ? e.start_dt.split("T")[0] : "",
        end_date: e.start_dt ? e.start_dt.split("T")[0] : "",
        start_time: e.start_dt ? e.start_dt.split("T")[1]?.slice(0, 5) ?? "" : "",
        end_time: "",
        recurrence: "none",
        recurrence_until: "",
        notes: e.description ?? "",
        _web_event_type: e.event_type,
        _web_location: e.location ?? "",
        _web_color: e.color ?? "",
      })),
      grades: data.grades.map((g, i) => ({
        id: i + 1,
        module_id: g.module_id ? (moduleIdMap.get(g.module_id) ?? 0) : 0,
        title: g.title ?? "",
        grade: g.grade ?? 0,
        max_grade: 6,
        weight: g.weight ?? 1.0,
        date: g.date ?? "",
        notes: g.notes ?? "",
        created_at: g.created_at,
        grade_mode: "direct",
        _web_exam_id: g.exam_id ?? null,
        _web_ects_earned: g.ects_earned ?? null,
      })),
      topics: data.topics.map((t, i) => ({
        id: i + 1,
        module_id: t.module_id ? (moduleIdMap.get(t.module_id) ?? 0) : 0,
        title: t.title,
        knowledge_level: t.knowledge_level ?? 0,
        notes: t.description ?? "",
        created_at: t.created_at ?? new Date().toISOString(),
        updated_at: t.created_at ?? new Date().toISOString(),
        task_id: t.task_id ? (taskIdMap.get(t.task_id) ?? null) : null,
        last_reviewed: t.last_reviewed ?? "",
        sr_easiness: t.sr_easiness ?? 2.5,
        sr_interval: t.sr_interval ?? 0,
        sr_repetitions: t.sr_repetitions ?? 0,
        sr_next_review: t.sr_next_review ?? "",
      })),
      time_logs: data.time_logs.map((l, i) => ({
        id: i + 1,
        module_id: l.module_id ? (moduleIdMap.get(l.module_id) ?? 0) : 0,
        start_ts: Math.floor(new Date(l.started_at).getTime() / 1000),
        end_ts: Math.floor(new Date(l.started_at).getTime() / 1000) + (l.duration_seconds ?? 0),
        seconds: l.duration_seconds ?? 0,
        kind: "study",
        note: l.note ?? "",
        created_at: l.created_at ?? l.started_at,
      })),
      stundenplan: data.stundenplan.map((s, i) => ({
        id: i + 1,
        day_of_week: s.day_of_week ?? 0,
        time_from: s.time_from ?? "",
        time_to: s.time_to ?? "",
        subject: s.subject ?? "",
        room: s.room ?? "",
        lecturer: s.lecturer ?? "",
        color: s.color ?? "#7C3AED",
        module_id: s.module_id ? (moduleIdMap.get(s.module_id) ?? null) : null,
        notes: s.notes ?? "",
      })),
      task_attachments: data.task_attachments.map((a, i) => ({
        id: i + 1,
        task_id: a.task_id ? (taskIdMap.get(a.task_id) ?? 0) : 0,
        kind: a.kind ?? "link",
        label: a.label ?? "",
        url: a.url ?? "",
        file_type: a.file_type ?? "",
        file_size: a.file_size ?? 0,
        created_at: a.created_at,
      })),
      // Web-only data (not in desktop, but included for backup)
      _web_extra: {
        exam_attachments: data.exam_attachments,
      },
    };
  }

  function downloadJSON(content: object, filename: string) {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setExporting(true);
    setExportResult(null);
    try {
      const data = await fetchAllData();
      const date = new Date().toISOString().split("T")[0];
      const counts = `${data.modules.length} Module, ${data.tasks.length} Aufgaben, ${data.events.length} Termine, ${data.grades.length} Noten, ${data.topics.length} Themen`;

      if (exportFormat === "desktop") {
        const desktopData = toDesktopFormat(data);
        downloadJSON(desktopData, `semetra-backup-${date}.json`);
        setExportResult({ type: "success", text: `Desktop-kompatibles Backup exportiert (${counts})` });
      } else {
        const rawExport = { _meta: { format: "semetra-web-raw", exported_at: new Date().toISOString() }, ...data };
        downloadJSON(rawExport, `semetra-web-export-${date}.json`);
        setExportResult({ type: "success", text: `Web-Rohdaten exportiert (${counts})` });
      }
    } catch (err: any) {
      setExportResult({ type: "error", text: `Export fehlgeschlagen: ${err.message}` });
    }
    setExporting(false);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-3">Datenschutz</h2>
        <p className="text-sm text-surface-600 leading-relaxed">
          Semetra speichert deine Daten sicher in der Cloud über Supabase (PostgreSQL). Alle Daten sind mit Row Level Security (RLS) geschützt — nur du hast Zugriff auf deine eigenen Daten.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-2">Daten exportieren</h2>
        <p className="text-sm text-surface-500 mb-4">
          Exportiere alle deine Daten als Backup oder zum Import in die Desktop-App.
          Module, Aufgaben, Prüfungen, Noten, Wissen, Zeitlogs, Stundenplan und Anhänge werden eingeschlossen.
        </p>

        {/* Format selection */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setExportFormat("desktop")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
              exportFormat === "desktop"
                ? "border-brand-300 bg-brand-50"
                : "border-surface-200 hover:border-surface-300"
            }`}
          >
            <HardDrive size={20} className={exportFormat === "desktop" ? "text-brand-600" : "text-surface-400"} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-surface-800">Desktop-kompatibel (empfohlen)</p>
              <p className="text-xs text-surface-500">
                Kann direkt in die Semetra Desktop-App importiert werden. Auch als Backup geeignet.
              </p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              exportFormat === "desktop" ? "border-brand-600" : "border-surface-300"
            }`}>
              {exportFormat === "desktop" && <div className="w-2 h-2 rounded-full bg-brand-600" />}
            </div>
          </button>

          <button
            onClick={() => setExportFormat("json")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
              exportFormat === "json"
                ? "border-brand-300 bg-brand-50"
                : "border-surface-200 hover:border-surface-300"
            }`}
          >
            <Database size={20} className={exportFormat === "json" ? "text-brand-600" : "text-surface-400"} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-surface-800">Web-Rohdaten (JSON)</p>
              <p className="text-xs text-surface-500">
                Originale Supabase-Daten mit UUIDs. Für technische Backups oder Datenanalyse.
              </p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              exportFormat === "json" ? "border-brand-600" : "border-surface-300"
            }`}>
              {exportFormat === "json" && <div className="w-2 h-2 rounded-full bg-brand-600" />}
            </div>
          </button>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? "Exportiere…" : "Daten exportieren"}
        </button>

        {/* Result message */}
        {exportResult && (
          <p className={`text-sm px-3 py-2 rounded-lg mt-3 ${
            exportResult.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {exportResult.type === "success" ? "✓ " : "✗ "}{exportResult.text}
          </p>
        )}

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
          <p className="text-xs text-amber-700">
            <strong>Tipp:</strong> Wenn die Cloud-Synchronisation nicht funktioniert, exportiere deine Daten hier
            und importiere sie in der Desktop-App unter Einstellungen → Daten importieren.
            Dateianhänge (PDFs etc.) werden als Links exportiert — die Dateien selbst müssen separat gesichert werden.
          </p>
        </div>
      </div>
    </div>
  );
}
