"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, User, Bell, Palette, Shield, LogOut, Zap, CreditCard, CheckCircle, Monitor, ExternalLink, Download, Loader2, FileJson, HardDrive, Database, Globe, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/hooks/useProfile";
import { COUNTRY_LIST, GRADING_SYSTEMS, type CountryCode } from "@/lib/grading-systems";
import { useTranslation, LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "@/lib/i18n";
import Link from "next/link";

export default function SettingsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const router = useRouter();
  const { profile, isPro, isLifetime } = useProfile();
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
    { id: "account",       label: t("settings.accountTab"),       icon: User },
    { id: "plan",          label: t("settings.planTab"),          icon: CreditCard },
    { id: "appearance",    label: t("settings.appearanceTab"),    icon: Palette },
    { id: "notifications", label: t("settings.notificationsTab"), icon: Bell },
    { id: "privacy",       label: t("settings.privacyTab"),       icon: Shield },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900">{t("settings.title")}</h1>
        <p className="text-surface-500 text-sm mt-0.5">{t("settings.subtitle")}</p>
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
            {t("sidebar.logout")}
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "account"       && <AccountTab user={user} profile={profile} />}
          {activeTab === "plan"          && <PlanTab isPro={isPro} isLifetime={isLifetime} profile={profile} />}
          {activeTab === "appearance"    && <AppearanceTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "privacy"       && <PrivacyTab />}
        </div>
      </div>
    </div>
  );
}

function AccountTab({ user, profile }: { user: { email?: string; created_at?: string } | null; profile: { country?: string | null } | null }) {
  const { t, locale } = useTranslation();
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>(profile?.country ?? "CH");
  const [countrySaving, setCountrySaving] = useState(false);
  const [countryMsg, setCountryMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync when profile loads
  useEffect(() => {
    if (profile?.country) setSelectedCountry(profile.country);
  }, [profile?.country]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setMsg({ type: "error", text: t("settings.passwordMismatch") }); return; }
    if (newPassword.length < 8) { setMsg({ type: "error", text: t("settings.minPasswordLength") }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) setMsg({ type: "error", text: error.message });
    else { setMsg({ type: "success", text: t("settings.passwordChanged") }); setNewPassword(""); setConfirmPassword(""); }
  }

  async function handleCountryChange() {
    setCountrySaving(true);
    setCountryMsg(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setCountrySaving(false); return; }
    const { error } = await supabase.from("profiles").update({ country: selectedCountry }).eq("id", authUser.id);
    setCountrySaving(false);
    if (error) setCountryMsg({ type: "error", text: error.message });
    else setCountryMsg({ type: "success", text: t("settings.gradingSystemUpdated") });
  }

  const currentSystem = GRADING_SYSTEMS[selectedCountry as CountryCode] ?? GRADING_SYSTEMS.CH;

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-4">{t("settings.accountInfo")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">E-Mail</label>
            <p className="text-sm text-surface-800 bg-surface-50 px-3 py-2.5 rounded-xl">{user?.email ?? "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">{t("settings.accountCreated")}</label>
            <p className="text-sm text-surface-800 bg-surface-50 px-3 py-2.5 rounded-xl">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString(locale === "de" ? "de-CH" : "en-US", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Country / Grading System */}
      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-1">{t("settings.countryTitle")}</h2>
        <p className="text-xs text-surface-400 mb-4">{t("settings.countryDesc")}</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("settings.countryLabel")}</label>
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              className="input w-full"
            >
              {COUNTRY_LIST.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCountryChange}
            disabled={countrySaving || selectedCountry === (profile?.country ?? "CH")}
            className="btn-primary shrink-0"
          >
            {countrySaving ? t("settings.countrySaving") : t("settings.countrySave")}
          </button>
        </div>
        {/* Preview of selected system */}
        <div className="mt-3 bg-surface-50 rounded-xl p-3 text-xs text-surface-500 space-y-1">
          <p>{t("settings.scaleLabel")}: <strong className="text-surface-700">{currentSystem.scaleLabel}</strong></p>
          <p>{t("settings.passingLabel")}: <strong className="text-surface-700">{currentSystem.passingGrade}</strong> · {t("settings.creditsLabel")}: <strong className="text-surface-700">{currentSystem.creditLabel}</strong></p>
        </div>
        {countryMsg && (
          <p className={`text-sm px-3 py-2 rounded-lg mt-3 ${countryMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {countryMsg.text}
          </p>
        )}
      </div>

      {/* Language */}
      <LanguageCard />

      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-4">{t("settings.passwordTitle")}</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("settings.newPassword")}</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("settings.minChars")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("settings.confirmPassword")}</label>
            <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("settings.confirmPlaceholder")} />
          </div>
          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t("common.saving") : t("settings.changePassword")}
          </button>
        </form>
      </div>

      <div className="card border-red-100">
        <h2 className="font-semibold text-red-700 mb-2">{t("settings.dangerZone")}</h2>
        <p className="text-sm text-surface-500 mb-3">{t("settings.deleteAccountWarning")}</p>
        <button className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
          {t("settings.deleteAccount")}
        </button>
      </div>
    </div>
  );
}

function PlanTab({ isPro, isLifetime, profile }: { isPro: boolean; isLifetime: boolean; profile: { stripe_subscription_status?: string | null; plan_expires_at?: string | null; plan_type?: string | null } | null }) {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch {}
    setLoading(false);
  }

  // Calculate subscription remaining time (only relevant for non-lifetime)
  const expiresAt = !isLifetime && profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const now = new Date();
  let remainingDays = 0;
  let remainingLabel = "";
  let aboExpired = false;

  if (expiresAt) {
    const diffMs = expiresAt.getTime() - now.getTime();
    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    aboExpired = remainingDays <= 0;

    if (aboExpired) {
      remainingLabel = t("settings.expired");
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
      {/* Plan card */}
      <div className={`card border-2 ${isPro ? "border-brand-500" : "border-surface-200"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-surface-900">
              {isLifetime ? t("settings.proLifetime") : isPro ? t("settings.proSubscription") : t("settings.yourPlan")}
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">
              {isLifetime ? t("settings.lifetimeDesc") : isPro ? t("settings.monthlyDesc") : t("settings.freeDesc")}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isLifetime ? "bg-surface-800 text-white" :
            isPro ? "bg-brand-100 text-brand-700" :
            "bg-surface-100 text-surface-500"
          }`}>
            {isLifetime ? "LIFETIME" : isPro ? "PRO" : "FREE"}
          </span>
        </div>

        {isLifetime ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-surface-600">
              <CheckCircle size={15} className="text-green-500" />
              {t("settings.lifetimeActive")}
            </div>
            <div className="bg-surface-50 rounded-xl p-4">
              <p className="text-sm text-surface-600">
                {t("settings.proInfo")}
              </p>
            </div>
          </div>
        ) : isPro ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-surface-600">
              <CheckCircle size={15} className="text-green-500" />
              {t("settings.subscriptionActive")} · {profile?.stripe_subscription_status === "trialing" ? t("settings.trialPhase") : t("settings.paid")}
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
                    {aboExpired ? t("settings.expired") : `${t("settings.remaining")} ${remainingLabel}`}
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
                      ? `${t("settings.expiredOn")} ${expiresAt.toLocaleDateString(locale === "de" ? "de-CH" : "en-US", { day: "2-digit", month: "long", year: "numeric" })}`
                      : `${t("settings.validUntil")} ${expiresAt.toLocaleDateString(locale === "de" ? "de-CH" : "en-US", { day: "2-digit", month: "long", year: "numeric" })}`
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
              {loading ? t("settings.openStripe") : t("settings.manageSubscription")}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-surface-500 mb-3">
              {t("settings.freeUsing")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/upgrade" className="btn-primary gap-2 inline-flex">
                <Zap size={14} />
                {t("settings.comparePlans")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Desktop ↔ Web Sync */}
      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-3">{t("settings.desktopWebSync")}</h2>
        <p className="text-sm text-surface-600 mb-2">
          {t("settings.syncInfo")}
        </p>
        <div className="bg-surface-50 rounded-xl p-3 text-xs text-surface-500 font-mono">
          Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—"}
        </div>
        {!isPro && (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl mt-3">
            {t("settings.syncProRequired")}
          </p>
        )}
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { t } = useTranslation();
  return (
    <div className="card">
      <h2 className="font-semibold text-surface-900 mb-4">{t("settings.appearance")}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">{t("settings.colorScheme")}</label>
          <div className="flex gap-3">
            {[
              { id: "light", label: t("settings.light"), emoji: "☀️" },
              { id: "dark", label: t("settings.dark"), emoji: "🌙" },
              { id: "system", label: t("settings.system"), emoji: "💻" },
            ].map(item => (
              <button key={item.id} className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium">
                <span className="text-xl">{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">{t("settings.accentColor")}</label>
          <div className="flex gap-2">
            {["#6d28d9","#2563eb","#059669","#dc2626","#d97706"].map(c => (
              <button key={c} className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform" style={{ background: c }} />
            ))}
          </div>
        </div>
        <p className="text-xs text-surface-400">{t("settings.moreAppearance")}</p>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    exam_reminder: true,
    task_deadline: true,
    weekly_summary: false,
    push: false,
  });

  return (
    <div className="card">
      <h2 className="font-semibold text-surface-900 mb-4">{t("settings.notifications")}</h2>
      <div className="space-y-4">
        {[
          { key: "exam_reminder" as const, label: t("settings.examReminders"), description: t("settings.examRemindersDesc") },
          { key: "task_deadline" as const, label: t("settings.taskDeadlines"), description: t("settings.taskDeadlinesDesc") },
          { key: "weekly_summary" as const, label: t("settings.weeklySummary"), description: t("settings.weeklySummaryDesc") },
          { key: "push" as const, label: t("settings.pushNotifications"), description: t("settings.pushNotificationsDesc") },
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
        <p className="text-xs text-surface-400 pt-2">{t("settings.settingsSavedLocally")}</p>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const { t } = useTranslation();
  const supabase = createClient();
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"desktop" | "json">("desktop");
  const [exportResult, setExportResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchAllData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(t("settings.notLoggedIn"));

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
      const counts = t("settings.exportCounts", { modules: String(data.modules.length), tasks: String(data.tasks.length), events: String(data.events.length), grades: String(data.grades.length), topics: String(data.topics.length) });

      if (exportFormat === "desktop") {
        const desktopData = toDesktopFormat(data);
        downloadJSON(desktopData, `semetra-backup-${date}.json`);
        setExportResult({ type: "success", text: t("settings.exportSuccess", { counts }) });
      } else {
        const rawExport = { _meta: { format: "semetra-web-raw", exported_at: new Date().toISOString() }, ...data };
        downloadJSON(rawExport, `semetra-web-export-${date}.json`);
        setExportResult({ type: "success", text: t("settings.exportSuccessJson", { counts }) });
      }
    } catch (err: any) {
      setExportResult({ type: "error", text: t("settings.exportFailed", { error: err.message }) });
    }
    setExporting(false);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-3">{t("settings.privacyTitle")}</h2>
        <p className="text-sm text-surface-600 leading-relaxed">
          {t("settings.privacyDesc")}
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-surface-900 mb-2">{t("settings.exportTitle")}</h2>
        <p className="text-sm text-surface-500 mb-4">
          {t("settings.exportDesc")}
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
              <p className="text-sm font-semibold text-surface-800">{t("settings.exportDesktopTitle")}</p>
              <p className="text-xs text-surface-500">
                {t("settings.exportDesktopDesc")}
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
              <p className="text-sm font-semibold text-surface-800">{t("settings.exportJsonTitle")}</p>
              <p className="text-xs text-surface-500">
                {t("settings.exportJsonDesc")}
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
          {exporting ? t("settings.exporting") : t("settings.exportData")}
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
            {t("settings.exportTip")}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Language Card ── */
function LanguageCard() {
  const supabase = createClient();
  const { locale, setLocale, t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Locale>(locale);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { setSelectedLang(locale); }, [locale]);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").update({ language: selectedLang }).eq("id", user.id);
    setSaving(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setLocale(selectedLang);
      setMsg({ type: "success", text: t("settings.languageSaved") });
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <Languages size={16} className="text-brand-600" />
        <h2 className="font-semibold text-surface-900">{t("settings.language")}</h2>
      </div>
      <p className="text-xs text-surface-400 mb-4">{t("settings.languageDesc2")}</p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-surface-700 mb-1">{t("settings.language")}</label>
          <select
            value={selectedLang}
            onChange={e => setSelectedLang(e.target.value as Locale)}
            className="input w-full"
          >
            {LOCALES.map(l => (
              <option key={l} value={l}>{LOCALE_FLAGS[l]} {LOCALE_LABELS[l]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || selectedLang === locale}
          className="btn-primary shrink-0"
        >
          {saving ? t("common.saving") : t("settings.save")}
        </button>
      </div>
      {msg && (
        <p className={`text-sm px-3 py-2 rounded-lg mt-3 ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
