"use client";
/**
 * useCommandCenter — High-Level Decision Hook
 *
 * Verbindet useModuleIntelligence mit der Decision Engine.
 * Liefert den kompletten CommandCenterState für das Dashboard.
 *
 * NEU: Lädt den aktuellsten DNA-Snapshot und speist ihn als
 * DnaProfile in die Engine ein → Gewichte und Schwellwerte
 * werden personalisiert (Feedback-Loop).
 *
 * WICHTIG: Nur EIN Mal pro Seite verwenden. Nicht zusammen mit
 * einem separaten useModuleIntelligence() aufrufen — dieser Hook
 * enthält die Intelligence bereits.
 */

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModuleIntelligence } from "./useModuleIntelligence";
import {
  buildCommandCenterState,
  buildAIContext,
  assessModuleRisk,
  generateActions,
} from "@/lib/decision/engine";
import type {
  CommandCenterState,
  AIDecisionContext,
  DecisionEngineConfig,
  ModuleIntelligence,
  DnaProfile,
  OnboardingProfile,
} from "@/lib/decision/types";
import { DEFAULT_ENGINE_CONFIG } from "@/lib/decision/types";

interface UseCommandCenterResult {
  /** Full Command Center state with priorities, risks, predictions, daily plan */
  state: CommandCenterState | null;
  /** Raw module intelligence data */
  modules: ModuleIntelligence[];
  /** Loading state (initial load only) */
  loading: boolean;
  /** Get AI context for a specific module */
  getAIContext: (moduleId: string) => AIDecisionContext | null;
  /** Trigger data refetch */
  refetch: () => void;
  /** Timestamp of last computation */
  computedAt: string | null;
  /** Active DNA profile (null if no snapshot exists) */
  dnaProfile: DnaProfile | null;
}

export function useCommandCenter(
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): UseCommandCenterResult {
  const { modules, loading, refetch, computedAt } = useModuleIntelligence();
  const supabase = createClient();
  const refreshCheckRef = useRef<NodeJS.Timeout | null>(null);
  const [dnaProfile, setDnaProfile] = useState<DnaProfile | null>(null);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const profilesLoadedRef = useRef(false);

  // ── Load DNA snapshot + Onboarding profile (once) ──
  useEffect(() => {
    if (profilesLoadedRef.current) return;
    profilesLoadedRef.current = true;

    async function loadProfiles() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load DNA and Onboarding in parallel
        const [dnaResult, onbResult] = await Promise.all([
          supabase
            .from("learning_dna_snapshots")
            .select("consistency_score, focus_score, endurance_score, adaptability_score, planning_score, overall_score, learner_type")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("onboarding_responses")
            .select("primary_goal, focus_challenge, exam_anxiety_level")
            .eq("user_id", user.id)
            .eq("is_complete", true)
            .maybeSingle(),
        ]);

        if (dnaResult.data) {
          setDnaProfile({
            consistencyScore: dnaResult.data.consistency_score,
            focusScore: dnaResult.data.focus_score,
            enduranceScore: dnaResult.data.endurance_score,
            adaptabilityScore: dnaResult.data.adaptability_score,
            planningScore: dnaResult.data.planning_score,
            overallScore: dnaResult.data.overall_score,
            learnerType: dnaResult.data.learner_type,
          });
        }

        if (onbResult.data) {
          setOnboardingProfile({
            primaryGoal: onbResult.data.primary_goal ?? "",
            focusChallenge: onbResult.data.focus_challenge ?? "moderate",
            examAnxietyLevel: onbResult.data.exam_anxiety_level ?? 3,
          });
        }
      } catch {
        // Gracefully ignore — features are non-critical
      }
    }

    loadProfiles();
  }, [supabase]);

  // Auto-Refresh: Prüfe periodisch ob ein Decision Engine Refresh nötig ist
  useEffect(() => {
    async function checkRefreshNeeded() {
      try {
        const { data } = await supabase.rpc("check_decision_refresh_needed");
        if (data === true) {
          refetch();
        }
      } catch {
        // RPC nicht verfügbar → ignorieren
      }
    }

    refreshCheckRef.current = setInterval(checkRefreshNeeded, 30_000);
    return () => {
      if (refreshCheckRef.current) clearInterval(refreshCheckRef.current);
    };
  }, [supabase, refetch]);

  // ── Auto-generate preference suggestions (once per session) ──
  // Triggers generate_preference_suggestions RPC if enough time has passed
  const suggestionsCheckedRef = useRef(false);
  useEffect(() => {
    if (suggestionsCheckedRef.current || loading || modules.length === 0) return;
    suggestionsCheckedRef.current = true;

    async function autoGenerateSuggestions() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if we already generated suggestions recently (< 24h ago)
        const { data: existing } = await supabase
          .from("preference_suggestions")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const lastCreated = new Date(existing.created_at).getTime();
          const hoursSince = (Date.now() - lastCreated) / (1000 * 60 * 60);
          if (hoursSince < 24) return; // Skip — already generated today
        }

        // Generate new suggestions based on pattern analysis
        await supabase.rpc("generate_preference_suggestions", {
          p_user_id: user.id,
        });
      } catch {
        // Gracefully ignore — feature is non-critical
      }
    }

    autoGenerateSuggestions();
  }, [supabase, loading, modules]);

  // Build state with DNA-personalized config
  const state = useMemo<CommandCenterState | null>(() => {
    if (loading || modules.length === 0) return null;
    try {
      return buildCommandCenterState(modules, config, dnaProfile, onboardingProfile);
    } catch (err) {
      console.error("[useCommandCenter] buildCommandCenterState failed:", err);
      return null;
    }
  }, [modules, loading, config, dnaProfile, onboardingProfile]);

  const getAIContext = useCallback(
    (moduleId: string): AIDecisionContext | null => {
      const module = modules.find((m) => m.moduleId === moduleId);
      if (!module) return null;
      const risk = assessModuleRisk(module, config);
      const actions = generateActions(module, risk, config);
      return buildAIContext(module, risk, actions);
    },
    [modules, config]
  );

  return { state, modules, loading, getAIContext, refetch, computedAt, dnaProfile };
}
