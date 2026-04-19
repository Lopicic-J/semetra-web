"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  GraduationCap, Building2, BookOpen, Edit2, Check, X, Sparkles, Lock, ExternalLink,
} from "lucide-react";

interface Props {
  profile: {
    university?: string | null;
    study_program?: string | null;
    active_program_id?: string | null;
    institution_id?: string | null;
  } | null;
  isPro: boolean;
  onUpdate: () => void;
}

/**
 * Study Info Card — profile page.
 *
 * Free users: manual text inputs for university and study_program (no verification,
 * no module auto-import).
 *
 * Pro users: same manual inputs, PLUS a "Aus Katalog wählen" action that jumps to
 * the Modul-Vorlagen catalog. There they pick institution + program, which sets
 * the structured IDs and auto-imports module templates for that program.
 */
export default function StudyInfoCard({ profile, isPro, onUpdate }: Props) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [university, setUniversity] = useState(profile?.university ?? "");
  const [studyProgram, setStudyProgram] = useState(profile?.study_program ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCatalogSelection = Boolean(profile?.active_program_id);

  async function save() {
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error: err } = await supabase
      .from("profiles")
      .update({
        university: university.trim() || null,
        study_program: studyProgram.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(false);
    onUpdate();
  }

  function cancel() {
    setUniversity(profile?.university ?? "");
    setStudyProgram(profile?.study_program ?? "");
    setEditing(false);
    setError(null);
  }

  return (
    <div className="bg-surface-100 rounded-2xl border border-surface-200 dark:border-surface-700 p-3 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-brand-600 dark:text-brand-400" />
          <h2 className="font-semibold text-surface-900 dark:text-white">Mein Studium</h2>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
          >
            <Edit2 size={12} /> Bearbeiten
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-xs text-surface-400 mb-4">
            {hasCatalogSelection
              ? "Aus dem Katalog gewählt — Module werden automatisch geladen."
              : "Selbst eingetragen (nicht verifiziert)."}
          </p>

          <div className="space-y-3">
            <ReadRow icon={<Building2 size={14} />} label="Hochschule" value={profile?.university} />
            <ReadRow icon={<BookOpen size={14} />} label="Studiengang" value={profile?.study_program} />
          </div>

          <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
            {isPro ? (
              <Link
                href="/studiengaenge"
                className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Sparkles size={14} />
                Aus Katalog wählen & Module automatisch laden
                <ExternalLink size={12} className="ml-auto" />
              </Link>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/30 border border-surface-200 dark:border-surface-700">
                <Lock size={14} className="text-surface-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-surface-500 dark:text-surface-400">
                  <p className="font-medium text-surface-700 dark:text-surface-200 mb-0.5">
                    Pro-Feature: Modul-Katalog
                  </p>
                  Mit Pro kannst du deinen Studiengang aus einem Katalog wählen und alle Module automatisch importieren.
                  {" "}
                  <Link href="/upgrade" className="text-brand-600 hover:text-brand-700 font-medium">
                    Upgrade
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-surface-400 mb-4">
            Trage deine Hochschule und deinen Studiengang ein. Wird nicht verifiziert.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
                Hochschule
              </label>
              <input
                type="text"
                value={university}
                onChange={e => setUniversity(e.target.value)}
                placeholder="z.B. ZHAW, ETH Zürich, HSLU"
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
                Studiengang
              </label>
              <input
                type="text"
                value={studyProgram}
                onChange={e => setStudyProgram(e.target.value)}
                placeholder="z.B. Informatik, BWL, Psychologie"
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition disabled:opacity-50"
            >
              <Check size={14} /> {saving ? "Speichere..." : "Speichern"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition"
            >
              <X size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReadRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-surface-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">{label}</p>
        <p className="text-sm text-surface-800 dark:text-surface-100 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}
