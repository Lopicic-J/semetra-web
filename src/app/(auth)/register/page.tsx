"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, Globe, GraduationCap, BookOpen, AtSign, Building2, Users, UserCircle, Info, Zap, Brain, Calendar, Shield, TrendingUp, Flame } from "lucide-react";
import { getEnabledProviders } from "@/lib/oauth-providers";
import { COUNTRY_LIST, DEFAULT_COUNTRY, type CountryCode } from "@/lib/grading-systems";
import { isUniversityEmail, getUniversityFromEmail, getInstitutionCodeFromEmail } from "@/lib/university-domains";

type UserRole = "student" | "non_student";

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string; icon: typeof Users }[] = [
  { value: "student", label: "Student", desc: "Ich studiere an einer Hochschule", icon: GraduationCap },
  { value: "non_student", label: "Andere", desc: "Ich nutze Semetra ohne Hochschul-Zugehörigkeit", icon: UserCircle },
];

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [university, setUniversity] = useState("");
  const [studyProgram, setStudyProgram] = useState("");
  // Structured institution/program selection
  const [institutions, setInstitutions] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; degree_level: string }[]>([]);
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedProgId, setSelectedProgId] = useState("");
  const [useStructured, setUseStructured] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showInstitutionInfo, setShowInstitutionInfo] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const enabledProviders = getEnabledProviders();

  // DB-based email domains (loaded from Supabase via API)
  const [dbDomains, setDbDomains] = useState<{ domain: string; institution_id: string; institution_name: string | null; institution_code: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/academic/email-domains")
      .then((r) => r.json())
      .then((data) => setDbDomains(data.domains || []))
      .catch(() => setDbDomains([]));
  }, []);

  // Combined domain detection: static map + DB domains
  const emailDomain = email ? email.split("@")[1]?.toLowerCase() : null;

  const dbMatch = emailDomain
    ? dbDomains.find((d) => emailDomain === d.domain || emailDomain.endsWith("." + d.domain))
    : null;

  const detectedUniversity = email ? (getUniversityFromEmail(email) || dbMatch?.institution_name) : null;
  const detectedInstCode = email ? (getInstitutionCodeFromEmail(email) || dbMatch?.institution_code) : null;
  const detectedInstIdFromDb = dbMatch?.institution_id || null;
  const isUniEmail = !!detectedUniversity;

  // Hard-Lock: Auto-assign institution when email domain is recognized
  const [institutionLocked, setInstitutionLocked] = useState(false);

  useEffect(() => {
    if (selectedRole === "student" && institutions.length > 0) {
      // Try direct institution_id match from DB domains first
      if (detectedInstIdFromDb) {
        const dbIdMatch = institutions.find((inst) => inst.id === detectedInstIdFromDb);
        if (dbIdMatch) {
          setSelectedInstId(dbIdMatch.id);
          setInstitutionLocked(true);
          setUseStructured(true);
          return;
        }
      }
      // Fallback: match by code from static map
      if (detectedInstCode) {
        const match = institutions.find(
          (inst) => inst.code?.toUpperCase() === detectedInstCode.toUpperCase()
        ) ?? institutions.find(
          (inst) => inst.name.toUpperCase().includes(detectedInstCode)
        );
        if (match) {
          setSelectedInstId(match.id);
          setInstitutionLocked(true);
          setUseStructured(true);
          return;
        }
      }
      setInstitutionLocked(false);
    } else {
      setInstitutionLocked(false);
    }
  }, [detectedInstCode, detectedInstIdFromDb, institutions, selectedRole]);

  // Load ALL institutions (no country filter) so email-domain detection works cross-country
  const loadInstitutions = useCallback(async () => {
    try {
      const res = await fetch(`/api/academic/institutions`);
      const data = await res.json();
      setInstitutions(data.institutions || []);
      setSelectedInstId("");
      setSelectedProgId("");
      setPrograms([]);
      if ((data.institutions || []).length === 0) setUseStructured(false);
      else setUseStructured(true);
    } catch {
      setInstitutions([]);
    }
  }, []);

  useEffect(() => { loadInstitutions(); }, [loadInstitutions]);

  // Load programs when institution changes
  useEffect(() => {
    if (!selectedInstId) { setPrograms([]); return; }
    fetch(`/api/academic/programs?institution_id=${selectedInstId}`)
      .then(r => r.json())
      .then(data => setPrograms(data.programs || []))
      .catch(() => setPrograms([]));
  }, [selectedInstId]);

  const usernameValid = /^[a-z0-9_-]{3,30}$/.test(username);

  // Debounced username availability check
  const checkTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
  function handleUsernameChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setUsername(clean);
    setUsernameStatus("idle");
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (clean.length < 3) return;
    if (!/^[a-z0-9_-]{3,30}$/.test(clean)) return;
    setUsernameStatus("checking");
    checkTimerRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc("get_email_by_username", { lookup_username: clean });
      setUsernameStatus(data ? "taken" : "available");
    }, 500);
  }

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
    if (!usernameValid) { setError("Benutzername muss 3\u201330 Zeichen lang sein (Kleinbuchstaben, Zahlen, _ oder -)"); return; }
    if (usernameStatus === "taken") { setError("Dieser Benutzername ist bereits vergeben"); return; }
    if (password.length < 8) { setError("Passwort muss mind. 8 Zeichen haben"); return; }
    setLoading(true);
    setError(null);

    // Final availability check
    const { data: existingEmail } = await supabase.rpc("get_email_by_username", { lookup_username: username });
    if (existingEmail) {
      setError("Dieser Benutzername ist bereits vergeben");
      setLoading(false);
      return;
    }

    // If university email is detected (static map OR DB domains), force student role
    const effectiveRole: UserRole = isUniEmail ? "student" : selectedRole;

    // Determine verification status based on email domain
    const autoVerified = effectiveRole === "student" && isUniEmail;
    const verificationStatus = effectiveRole === "non_student"
      ? "none"
      : autoVerified
        ? "verified"
        : "pending";

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { country },
      },
    });

    // Save country + role + optional fields to profile directly
    if (data?.user?.id) {
      const profileData: Record<string, unknown> = {
        country,
        username,
        user_role: effectiveRole,
        verification_status: verificationStatus,
      };

      // Store verified domain for audit trail
      if (autoVerified) {
        profileData.verified_email_domain = email.split("@")[1]?.toLowerCase();
        profileData.verification_submitted_at = new Date().toISOString();
        profileData.verification_reviewed_at = new Date().toISOString();
      } else if (effectiveRole === "student") {
        profileData.verification_submitted_at = new Date().toISOString();
      }

      if (effectiveRole === "student" && institutionLocked && selectedInstId) {
        profileData.institution_id = selectedInstId;
        if (selectedProgId) {
          profileData.active_program_id = selectedProgId;
          // Trigger module auto-import on first login
          profileData.institution_modules_loaded = false;
        }
        const inst = institutions.find(i => i.id === selectedInstId);
        const prog = programs.find(p => p.id === selectedProgId);
        if (inst) profileData.university = inst.name;
        if (prog) profileData.study_program = prog.name;
      }

      await supabase.from("profiles").update(profileData).eq("id", data.user.id);
    }

    if (error) {
      setError(error.message);
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
      <div className="min-h-screen flex">
        {/* LEFT — Feature Showcase (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />
          <div className="relative z-10 flex flex-col items-center justify-center flex-1">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <CheckCircle2 size={40} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Fast geschafft!</h2>
            <p className="text-white/60 text-sm text-center max-w-xs">
              Bestätige deine E-Mail und starte mit Semetra durch.
            </p>
          </div>
          <div className="relative z-10">
            <p className="text-[11px] text-white/30">
              &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Gebaut in der Schweiz
            </p>
          </div>
        </div>

        {/* RIGHT — Success */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-brand-50/40 via-white to-surface-50 p-4 sm:p-8">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Bestätigungsmail gesendet</h1>
            <p className="text-surface-500 text-sm mb-6">
              Wir haben eine E-Mail an <strong className="text-surface-700">{email}</strong> gesendet.
              Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
            </p>
            {isUniEmail && (
              <p className="text-green-600 text-sm mb-4">
                Deine Hochschul-Email wurde erkannt ({detectedUniversity}) — dein Account wird automatisch als Student verifiziert.
              </p>
            )}
            {selectedRole === "student" && !isUniEmail && (
              <p className="text-amber-600 text-sm mb-4">
                Dein Account wartet auf manuelle Freischaltung. Tipp: Verwende deine Hochschul-Email für sofortige Verifizierung.
              </p>
            )}
            <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700 text-sm">
              Zurück zum Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Feature Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-[#0d0820] via-[#1a1040] to-[#0d0820] text-white p-10 relative overflow-hidden">
        {/* Decorative orbs */}
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
              Kostenlos & sofort.
            </span>
          </h2>
          <p className="text-white/60 text-sm mb-10 max-w-sm leading-relaxed">
            50+ Tools, Decision Engine, KI-Assistent — alles was du brauchst, um dein Studium zu meistern.
          </p>

          <div className="space-y-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
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
            <h1 className="text-2xl font-bold text-surface-900">Konto erstellen</h1>
            <p className="text-surface-500 text-sm mt-1">Starte kostenlos mit Semetra Workspace</p>
          </div>

          <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl shadow-surface-200/50 border border-surface-200/60 p-6 sm:p-8">
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
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">Ich bin...</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedRole(value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition text-center ${
                        selectedRole === value
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-surface-200 bg-surface-50 text-surface-600 hover:border-surface-300"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-[9px] leading-tight opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
                {/* Institution info hint */}
                <button
                  type="button"
                  onClick={() => setShowInstitutionInfo(!showInstitutionInfo)}
                  className="flex items-center gap-1 mt-2 text-[10px] text-surface-400 hover:text-surface-600 transition"
                >
                  <Building2 size={12} />
                  <span>Sie vertreten eine Hochschule?</span>
                </button>
                {showInstitutionInfo && (
                  <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                    <div className="flex items-start gap-2">
                      <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-medium mb-1">Institutions-Zugang</p>
                        <p>
                          Institutionen werden persönlich eingerichtet.
                          Kontaktieren Sie uns unter{" "}
                          <a href="mailto:kontakt@semetra.ch" className="font-semibold underline">
                            kontakt@semetra.ch
                          </a>
                          {" "}für ein Erstgespräch.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Benutzername</label>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
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
                  usernameStatus === "available" ? "text-green-600" :
                  usernameStatus === "taken" ? "text-red-500" :
                  username.length > 0 && !usernameValid ? "text-red-500" :
                  "text-surface-400"
                }`}>
                  {usernameStatus === "checking" ? "Wird geprüft..." :
                   usernameStatus === "available" ? "\u2713 Verfügbar" :
                   usernameStatus === "taken" ? "\u2717 Bereits vergeben" :
                   username.length > 0 && !usernameValid ? "3\u201330 Zeichen: Kleinbuchstaben, Zahlen, _ und -" :
                   "Dein eindeutiger Benutzername zum Anmelden"}
                </p>
              </div>

              {/* Email with university detection */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">E-Mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                    type="email"
                    placeholder={selectedRole === "student" ? "deine@hochschule.ch" : "deine@email.ch"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                {/* University email detection feedback */}
                {selectedRole === "student" && email.includes("@") && (
                  <p className={`text-[10px] mt-1 ${isUniEmail ? "text-green-600" : "text-surface-400"}`}>
                    {isUniEmail
                      ? `\u2713 Hochschul-Email erkannt: ${detectedUniversity} — automatische Verifizierung`
                      : "Tipp: Verwende deine Hochschul-Email (@zhaw.ch, @ethz.ch, etc.) für sofortige Verifizierung"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Passwort</label>
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

              {/* University / Program — only for students */}
              {selectedRole === "student" && institutionLocked ? (
                <>
                  {/* Institution: auto-assigned, locked */}
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">Hochschule</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" />
                      <select
                        value={selectedInstId}
                        disabled
                        className="w-full border rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none transition appearance-none bg-green-50 border-green-300 text-surface-900 cursor-not-allowed"
                      >
                        <option value="">-- Hochschule wählen --</option>
                        {institutions.map(inst => (
                          <option key={inst.id} value={inst.id}>{inst.name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Automatisch zugewiesen anhand deiner Hochschul-Email ({detectedUniversity})
                    </p>
                  </div>

                  {/* Program: student must select */}
                  {selectedInstId && (
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">Studiengang</label>
                      <div className="relative">
                        <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <select
                          value={selectedProgId}
                          onChange={e => setSelectedProgId(e.target.value)}
                          className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition appearance-none"
                        >
                          <option value="">{programs.length === 0 ? "Keine Studiengänge verfügbar" : "-- Studiengang wählen --"}</option>
                          {programs.map(prog => (
                            <option key={prog.id} value={prog.id}>{prog.name} ({prog.degree_level})</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                        <Info size={10} />
                        Wähle sorgfältig — der Studiengang kann nachträglich nur durch den Support oder deine Hochschule geändert werden.
                      </p>
                    </div>
                  )}
                </>
              ) : selectedRole === "student" && !institutionLocked ? (
                /* No university email detected — show hint */
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Building2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-1">Hochschul-Email erforderlich</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Gib oben deine Hochschul-Email ein (z.B. @zhaw.ch, @ethz.ch, @fhnw.ch), damit deine Hochschule automatisch erkannt wird.
                        Deine Institution und dein Studiengang werden anhand deiner Email-Adresse zugewiesen.
                      </p>
                      {email.includes("@") && !isUniEmail && (
                        <p className="text-xs text-amber-800 font-medium mt-2">
                          Die Domain &quot;{email.split("@")[1]}&quot; ist nicht als Hochschul-Email hinterlegt.
                          Falls deine Hochschule fehlt, kontaktiere <a href="mailto:support@semetra.ch" className="underline">support@semetra.ch</a>.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Country / Grading system */}
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Land / Notensystem</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value as CountryCode)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition appearance-none"
                  >
                    {COUNTRY_LIST.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-surface-400 mt-1">Bestimmt dein Notensystem. Kann später geändert werden.</p>
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
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Konto erstellen <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500 mt-5">
              Bereits registriert?{" "}
              <Link href="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition">
                Anmelden
              </Link>
            </p>
          </div>

          {/* Footer (mobile) */}
          <p className="text-center text-[11px] text-surface-400 mt-6 lg:hidden">
            &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
