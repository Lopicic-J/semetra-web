"use client";
/**
 * SmartAutomationsProvider
 *
 * DEPRECATED: Smart automations are now integrated directly into
 * the CommandCenter component via useSmartAutomations({ state, modules }).
 * This file is kept for backward compatibility but should not be used.
 *
 * The old version created its own useCommandCenter + useModuleIntelligence
 * instances which caused duplicate Supabase subscriptions and loops.
 */

import type { CommandCenterState, ModuleIntelligence } from "@/lib/decision/types";
import { useSmartAutomations } from "@/lib/hooks/useSmartAutomations";

interface Props {
  state: CommandCenterState | null;
  modules: ModuleIntelligence[];
  enabled?: boolean;
}

export default function SmartAutomationsProvider({ state, modules, enabled = true }: Props) {
  useSmartAutomations({ state, modules, enabled });
  return null;
}
