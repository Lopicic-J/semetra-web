"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, Globe, GraduationCap, BookOpen, AtSign, Building2, Users, UserCircle, Info } from "lucide-react";
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

  // Check if email is a known university email
  const detectedUniversity = email ? getUniversityFromEmail(email) : null;
  const detectedInstCode = email ? getInstitutionCodeFromEmail(email) : null;
  const isUniEmail = !!detectedUniversity;

  // Hard-Lock: Auto-assign institution when email domain is recognized
  const [institutionLocked, setInstitutionLocked] = useState(false);

  useEffect(() => {
    if (selectedRole === "student" && detectedInstCode && institutions.length > 0) {
      // Find institution by code (case-insensitive), prefer exact code match
      const match = institutions.find(
        (inst) => inst.code?.toUpperCase() === detectedInstCode.toUpperCase()
      ) ?? institutions.find(
        (inst) => inst.name.toUpperCase().includes(detectedInstCode)
      );
      if (match) {
        setSelectedInstId(match.id);
        setInstitutionLocked(true);
        setUseStructured(true);
      } else {
        setInstitutionLocked(false);
      }
    } else {
      setInstitutionLocked(false);
    }
  }, [detectedInstCode, institutions, selectedRole]);

  // Load institutions when country changes
  const loadInstitutions = useCallback(async () => {
    try {
      const res = await fetch(`/api/academic/institutions?country=${country}`);
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
  }, [country]);

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

    // Determine verification status based on email domain
    const autoVerified = selectedRole === "student" && isUniversityEmail(email);
    const verificationStatus = selectedRole === "non_student"
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
        user_role: selectedRole,
        verification_status: verificationStatus,
      };

      // Store verified domain for audit trail
      if (autoVerified) {
        profileData.verified_email_domain = email.split("@")[1]?.toLowerCase();
        profileData.verification_submitted_at = new Date().toISOString();
        profileData.verification_reviewed_at = new Date().toISOString();
      } else if (selectedRole === "student") {
        profileData.verification_submitted_at = new Date().toISOString();
      }

      if (selectedRole === "student") {
        if (useStructured && selectedInstId) {
          // When institution is locked by email, always use the locked institution
          // (defense-in-depth: even if client is manipulated, the DB trigger also enforces this)
          const effectiveInstId = institutionLocked ? selectedInstId : selectedInstId;
          profileData.institution_id = effectiveInstId;
          if (selectedProgId) profileData.active_program_id = selectedProgId;
          const inst = institutions.find(i => i.id === effectiveInstId);
          const prog = programs.find(p => p.id === selectedProgId);
          if (inst) profileData.university = inst.name;
          if (prog) profileData.study_program = prog.name;
        } else if (!institutionLocked) {
          // Free text only allowed when institution is NOT locked by email
          if (university.trim()) profileData.university = university.trim();
          if (studyProgram.trim()) profileData.study_program = studyProgram.trim();
        }
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/60 via-white to-surface-100 p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Bestätigungsmail gesendet</h1>
          <p className="text-surface-500 text-sm mb-6">
            Wir haben eine E-Mail an <strong className="text-surface-700">{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
          </p>
          {selectedRole === "student" && isUniEmail && (
            <p className="text-green-600 text-sm mb-4">
              Deine Hochschul-Email wurde erkannt ({detectedUniversity}) — dein Account wird automatisch verifiziert.
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
            {selectedRole === "student" && useStructured && institutions.length > 0 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Hochschule</label>
                  <div className="relative">
                    <Building2 size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${institutionLocked ? "text-green-500" : "text-surface-400"}`} />
                    <select
                      value={selectedInstId}
                      onChange={e => { if (!institutionLocked) { setSelectedInstId(e.target.value); setSelectedProgId(""); } }}
                      disabled={institutionLocked}
                      className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none transition appearance-none ${
                        institutionLocked
                          ? "bg-green-50 border-green-300 text-surface-900 cursor-not-allowed"
                          : "bg-surface-50 border-surface-200 text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      }`}
                    >
                      <option value="">-- Hochschule wählen --</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>
                  {institutionLocked && (
                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Automatisch zugewiesen anhand deiner Hochschul-Email ({detectedUniversity})
                    </p>
                  )}
                </div>
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
                  </div>
                )}
                {/* Only show Freitext option when institution is NOT locked by email */}
                {!institutionLocked && (
                  <button type="button" onClick={() => setUseStructured(false)}
                    className="text-[10px] text-brand-500 hover:text-brand-600 text-left">
                    Meine Hochschule ist nicht in der Liste? Freitext eingeben
                  </button>
                )}
              </>
            ) : selectedRole === "student" && !institutionLocked ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Universität / Fachhochschule</label>
                  <div className="relative">
                    <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                      type="text"
                      placeholder="z. B. ETH Zürich, ZHAW, FHNW..."
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                  <p className="text-[10px] text-surface-400 mt-1">Optional. Kann später im Profil geändert werden.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Studienrichtung</label>
                  <div className="relative">
                    <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition"
                      type="text"
                      placeholder="z. B. Informatik, BWL, Medizin..."
                      value={studyProgram}
                      onChange={e => setStudyProgram(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-surface-400 mt-1">Optional. Kann später im Profil geändert werden.</p>
                </div>
                {institutions.length > 0 && (
                  <button type="button" onClick={() => setUseStructured(true)}
                    className="text-[10px] text-brand-500 hover:text-brand-600 text-left">
                    Aus der Hochschul-Datenbank wählen
                  </button>
                )}
              </>
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

        <p className="text-center text-[11px] text-surface-400 mt-6">
          &copy; {new Date().getFullYear()} Lopicic Technologies &middot; Semetra Workspace
        </p>
      </div>
    </div>
  );
}
