"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useTranslation, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "@/lib/i18n";
import { COUNTRY_LIST, type CountryCode } from "@/lib/grading-systems";
import Link from "next/link";
import {
  User,
  Mail,
  Globe,
  Languages,
  Calendar,
  Zap,
  Sparkles,
  Crown,
  CreditCard,
  ExternalLink,
  Settings,
  CheckCircle,
  Edit3,
  X,
  Save,
  Loader2,
  Camera,
  GraduationCap,
  BookOpen,
  Hash,
  AtSign,
} from "lucide-react";

interface AiUsage {
  used: number;
  addon_credits: number;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { profile, isPro, isLifetime, planTier, loading, refetch } = useProfile();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage>({ used: 0, addon_credits: 0 });

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email, created_at: data.user.created_at } : null);
    });
  }, [supabase]);

  // Load AI usage
  const loadAiUsage = useCallback(async () => {
    if (!profile?.id) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data } = await supabase
      .from("ai_usage")
      .select("used, addon_credits")
      .eq("user_id", profile.id)
      .eq("month", month)
      .single();
    if (data) setAiUsage(data);
  }, [supabase, profile?.id]);

  useEffect(() => { loadAiUsage(); }, [loadAiUsage]);

  // Plan helpers
  const planLabel = (() => {
    if (!profile) return "Free";
    if (isLifetime) return planTier === "full" ? "Lifetime Full" : "Lifetime Basic";
    if (isPro) return planTier === "full" ? "Pro Full" : "Pro Basic";
    return "Free";
  })();

  const planColor = isPro
    ? planTier === "full" ? "from-violet-600 to-brand-600" : "from-brand-600 to-brand-500"
    : "from-surface-400 to-surface-500";

  const subscriptionStatus = (() => {
    if (!profile || profile.plan === "free") return "Kein Abo";
    if (isLifetime) return "Lifetime — unbegrenzt";
    const s = profile.stripe_subscription_status;
    if (s === "active") return "Aktiv";
    if (s === "trialing") return "Testphase";
    if (s === "canceled" || s === "past_due") {
      if (profile.plan_expires_at) {
        const days = Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000);
        if (days > 0) return `Läuft aus in ${days} Tagen`;
        return "Abgelaufen";
      }
      return "Gekündigt";
    }
    return s || "—";
  })();

  const aiPool = (() => {
    if (!profile || profile.plan === "free") return 3;
    if (isLifetime) return planTier === "full" ? 20 : 0;
    return planTier === "full" ? 100 : 10;
  })();

  const totalPool = aiPool + aiUsage.addon_credits;
  const aiPercent = totalPool > 0 ? Math.min(100, (aiUsage.used / totalPool) * 100) : 0;
  const aiRemaining = Math.max(0, totalPool - aiUsage.used);

  // Field editing
  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setFieldValue(currentValue);
  }

  async function saveEdit() {
    if (!profile?.id || !editingField) return;
    setSaving(true);

    // Username: extra validation + availability check
    if (editingField === "username") {
      const uname = fieldValue.trim().toLowerCase();
      if (!/^[a-z0-9_-]{3,30}$/.test(uname)) {
        alert("Benutzername muss 3–30 Zeichen lang sein (Kleinbuchstaben, Zahlen, _ oder -).");
        setSaving(false);
        return;
      }
      if (uname !== profile.username) {
        const { data: existing } = await supabase.rpc("get_email_by_username", { lookup_username: uname });
        if (existing) {
          alert("Dieser Benutzername ist bereits vergeben.");
          setSaving(false);
          return;
        }
      }
      await supabase.from("profiles").update({ username: uname }).eq("id", profile.id);
      await refetch();
      setEditingField(null);
      setSaving(false);
      return;
    }

    const dbField = editingField === "name" ? "full_name" : editingField;
    const value = editingField === "semester" ? (parseInt(fieldValue) || null) : fieldValue.trim();

    await supabase.from("profiles").update({ [dbField]: value }).eq("id", profile.id);
    await refetch();
    setEditingField(null);
    setSaving(false);
  }

  // Avatar upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Bild darf max. 2 MB gross sein.");
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/avatar.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("Avatar upload failed:", uploadError);
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`; // Cache-bust

    // Save to profile
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
    await refetch();
    setUploadingAvatar(false);
  }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "—";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header with Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative group">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className={`w-[72px] h-[72px] rounded-2xl object-cover shadow-lg ${uploadingAvatar ? "opacity-50" : ""}`}
            />
          ) : (
            <div className={`w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${planColor} text-white flex items-center justify-center text-2xl font-bold shadow-lg`}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Upload overlay */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            {uploadingAvatar ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : (
              <Camera size={20} className="text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            {editingField !== "name" ? (
              <>
                <h1 className="text-2xl font-bold text-surface-900">{displayName}</h1>
                <button
                  onClick={() => startEdit("name", profile?.full_name || "")}
                  className="text-surface-400 hover:text-brand-600 transition"
                >
                  <Edit3 size={14} />
                </button>
              </>
            ) : (
              <InlineEditor
                value={fieldValue}
                onChange={setFieldValue}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
                saving={saving}
                placeholder="Dein Name"
              />
            )}
          </div>
          <p className="text-surface-500 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              isPro
                ? planTier === "full" ? "bg-violet-100 text-violet-700" : "bg-brand-100 text-brand-700"
                : "bg-surface-100 text-surface-500"
            }`}>
              {isLifetime && <Crown size={10} />}
              {isPro && planTier === "full" && <Sparkles size={10} />}
              {planLabel}
            </span>
            {profile?.university && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-100 text-surface-600">
                <GraduationCap size={10} /> {profile.university}
              </span>
            )}
            <span className="text-xs text-surface-400">
              Mitglied seit {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {/* Plan Card */}
        <div className="bg-surface-900 text-white rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-semibold uppercase tracking-wide mb-3">
              <CreditCard size={12} /> Dein Abo
            </div>
            <p className="text-xl font-bold mb-1">{planLabel}</p>
            <p className="text-sm text-white/60 mb-4">{subscriptionStatus}</p>
            {isPro && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["Unbegrenzte Module", "Sync", "Themes", ...(planTier === "full" ? ["KI-Assistent"] : [])].map(f => (
                  <span key={f} className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium">{f}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              {!isPro ? (
                <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white text-surface-900 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-surface-100 transition">
                  <Zap size={12} /> Upgrade auf Pro
                </Link>
              ) : (
                <>
                  <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white text-surface-900 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-surface-100 transition">
                    Abo verwalten
                  </Link>
                  <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/20 transition">
                    <Sparkles size={12} /> Add-on
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Usage Card */}
        <div className="bg-surface-100 rounded-2xl border border-surface-200 p-5">
          <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-3">
            <Sparkles size={12} /> KI-Nutzung (Monat)
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-surface-900">{aiUsage.used}</span>
            <span className="text-sm text-surface-400 font-medium">/ {totalPool}</span>
          </div>
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500" style={{ width: `${aiPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            <span>Verbraucht</span>
            <span>{aiRemaining} verbleibend</span>
          </div>
          {aiUsage.addon_credits > 0 && (
            <p className="text-xs text-violet-600 font-medium mt-2">+ {aiUsage.addon_credits} Add-on-Credits inkludiert</p>
          )}
          {totalPool === 0 && isPro && (
            <p className="text-xs text-surface-400 mt-2">
              Dein Lifetime Basic Plan enthält keine KI-Requests.{" "}
              <Link href="/upgrade" className="text-violet-600 font-medium">Add-on kaufen</Link>
            </p>
          )}
        </div>
      </div>

      {/* Study Info */}
      <div className="bg-surface-100 rounded-2xl border border-surface-200 p-5 mb-4">
        <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-4">
          <GraduationCap size={12} /> Studium
        </div>

        <EditableRow
          icon={<GraduationCap size={14} />}
          label="Hochschule / Universität"
          value={profile?.university || "—"}
          editing={editingField === "university"}
          onEdit={() => startEdit("university", profile?.university || "")}
          editValue={fieldValue}
          onEditChange={setFieldValue}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          placeholder="z.B. ETH Zürich, ZHAW, Uni Wien"
        />
        <EditableRow
          icon={<BookOpen size={14} />}
          label="Studienrichtung"
          value={profile?.study_program || "—"}
          editing={editingField === "study_program"}
          onEdit={() => startEdit("study_program", profile?.study_program || "")}
          editValue={fieldValue}
          onEditChange={setFieldValue}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          placeholder="z.B. Informatik, BWL, Medizin"
        />
        <EditableRow
          icon={<Hash size={14} />}
          label="Semester"
          value={profile?.semester ? `${profile.semester}. Semester` : "—"}
          editing={editingField === "semester"}
          onEdit={() => startEdit("semester", profile?.semester?.toString() || "")}
          editValue={fieldValue}
          onEditChange={setFieldValue}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          placeholder="z.B. 3"
          type="number"
        />
      </div>

      {/* Account Details */}
      <div className="bg-surface-100 rounded-2xl border border-surface-200 p-5 mb-4">
        <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-4">
          <User size={12} /> Konto-Details
        </div>

        <EditableRow
          icon={<AtSign size={14} />}
          label="Benutzername"
          value={profile?.username ? `@${profile.username}` : "—"}
          editing={editingField === "username"}
          onEdit={() => startEdit("username", profile?.username || "")}
          editValue={fieldValue}
          onEditChange={(v) => setFieldValue(v.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          placeholder="z.B. max_muster"
          hint="Dein eindeutiger Benutzername zum Anmelden"
        />

        <DetailRow icon={<Mail size={14} />} label="E-Mail" value={user?.email || "—"} />

        <EditableRow
          icon={<Globe size={14} />}
          label="Land / Notensystem"
          value={COUNTRY_LIST.find(c => c.code === profile?.country)?.name || profile?.country || "—"}
          editing={editingField === "country"}
          onEdit={() => startEdit("country", profile?.country || "CH")}
          editValue={fieldValue}
          onEditChange={setFieldValue}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          type="select"
          options={COUNTRY_LIST.map(c => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
          hint="Ändert automatisch dein Notensystem im Notenrechner"
        />

        <EditableRow
          icon={<Languages size={14} />}
          label="Sprache"
          value={profile?.language ? `${LOCALE_FLAGS[profile.language as Locale] || ""} ${LOCALE_LABELS[profile.language as Locale] || profile.language}` : "Deutsch"}
          editing={editingField === "language"}
          onEdit={() => startEdit("language", profile?.language || "de")}
          editValue={fieldValue}
          onEditChange={setFieldValue}
          onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          saving={saving}
          type="select"
          options={Object.entries(LOCALE_LABELS).map(([k, v]) => ({ value: k, label: `${LOCALE_FLAGS[k as Locale] || ""} ${v}` }))}
        />

        <DetailRow icon={<Calendar size={14} />} label="Mitglied seit" value={memberSince} />
      </div>

      {/* Quick Actions */}
      <div className="bg-surface-100 rounded-2xl border border-surface-200 p-5">
        <div className="flex items-center gap-1.5 text-surface-400 text-[10px] font-semibold uppercase tracking-wide mb-4">
          Schnellzugriff
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/settings" icon={<Settings size={14} />} label="Einstellungen" />
          <QuickLink href="/upgrade" icon={<Zap size={14} />} label="Upgrade / Add-on" />
          <QuickLink href="/dashboard" icon={<ExternalLink size={14} />} label="Dashboard" />
          <a
            href="https://semetra.ch/profil.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition"
          >
            <Globe size={14} /> Profil auf semetra.ch
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ─── */

function InlineEditor({
  value, onChange, onSave, onCancel, saving, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        placeholder={placeholder}
        autoFocus
        onKeyDown={e => e.key === "Enter" && onSave()}
      />
      <button onClick={onSave} disabled={saving} className="text-brand-600 hover:text-brand-500">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      </button>
      <button onClick={onCancel} className="text-surface-400 hover:text-surface-600">
        <X size={14} />
      </button>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
      <div className="flex items-center gap-2.5 text-surface-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-surface-900">{value}</span>
    </div>
  );
}

function EditableRow({
  icon, label, value, editing, onEdit, editValue, onEditChange, onSave, onCancel, saving,
  placeholder, type = "text", options, hint,
}: {
  icon: React.ReactNode; label: string; value: string;
  editing: boolean; onEdit: () => void;
  editValue: string; onEditChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; placeholder?: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  hint?: string;
}) {
  if (editing) {
    return (
      <div className="py-3 border-b border-surface-100 last:border-0">
        <div className="flex items-center gap-2.5 text-surface-500 mb-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2 ml-[26px]">
          {type === "select" && options ? (
            <select
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none bg-surface-100"
              autoFocus
            >
              {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              type={type}
              min={type === "number" ? "1" : undefined}
              max={type === "number" ? "20" : undefined}
              className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              placeholder={placeholder}
              autoFocus
              onKeyDown={e => e.key === "Enter" && onSave()}
            />
          )}
          <button onClick={onSave} disabled={saving} className="text-brand-600 hover:text-brand-500">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          </button>
          <button onClick={onCancel} className="text-surface-400 hover:text-surface-600">
            <X size={14} />
          </button>
        </div>
        {hint && <p className="text-[11px] text-surface-400 ml-[26px] mt-1">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
      <div className="flex items-center gap-2.5 text-surface-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-surface-900">{value}</span>
        <button onClick={onEdit} className="text-surface-400 hover:text-brand-600 transition">
          <Edit3 size={12} />
        </button>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition"
    >
      {icon} {label}
    </Link>
  );
}
