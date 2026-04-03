"use client";
import { useProfile } from "./useProfile";
import { getGradingSystem, type GradingSystem, type CountryCode } from "../grading-systems";

/**
 * Returns the active grading system for the current user.
 * Falls back to CH (Switzerland) if no country is set.
 */
export function useGradingSystem(): GradingSystem & { loading: boolean } {
  const { profile, loading } = useProfile();
  const country = (profile as { country?: CountryCode | null } | null)?.country ?? null;
  const system = getGradingSystem(country);
  return { ...system, loading };
}
