"use client";
/**
 * useCommandCenter — High-Level Decision Hook
 *
 * Verbindet useModuleIntelligence mit der Decision Engine.
 * Liefert den kompletten CommandCenterState für das Dashboard.
 *
 * WICHTIG: Nur EIN Mal pro Seite verwenden. Nicht zusammen mit
 * einem separaten useModuleIntelligence() aufrufen — dieser Hook
 * enthält die Intelligence bereits.
 */

import { useMemo, useCallback, useEffect, useRef } from "react";
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
}

export function useCommandCenter(
  config: DecisionEngineConfig = DEFAULT_ENGINE_CONFIG
): UseCommandCenterResult {
  const { modules, loading, refetch, computedAt } = useModuleIntelligence();
  const supabase = createClient();
  const refreshCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-Refresh: Prüfe periodisch ob ein Decision Engine Refresh nötig ist
  // (z.B. nach Noten-Änderung, die einen Trigger in der DB auslöst)
  useEffect(() => {
    async function checkRefreshNeeded() {
      try {
        const { data } = await supabase.rpc("check_decision_refresh_needed");
        if (data === true) {
          refetch();
        }
      } catch {
        // RPC nicht verfügbar → ignorieren (Migration noch nicht ausgeführt)
      }
    }

    // Alle 30 Sekunden prüfen
    refreshCheckRef.current = setInterval(checkRefreshNeeded, 30_000);
    return () => {
      if (refreshCheckRef.current) clearInterval(refreshCheckRef.current);
    };
  }, [supabase, refetch]);

  const state = useMemo<CommandCenterState | null>(() => {
    if (loading || modules.length === 0) return null;
    return buildCommandCenterState(modules, config);
  }, [modules, loading, config]);

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

  return { state, modules, loading, getAIContext, refetch, computedAt };
}
