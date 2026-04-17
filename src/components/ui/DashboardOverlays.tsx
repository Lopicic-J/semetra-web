"use client";

import dynamic from "next/dynamic";

// Lazy-loaded: none of these are needed for initial render
const InstallPrompt = dynamic(() => import("@/components/pwa/InstallPrompt"), { ssr: false });
const WelcomeTour = dynamic(() => import("@/components/onboarding/WelcomeTour"), { ssr: false });
const UnifiedFABWrapper = dynamic(() => import("@/components/ui/UnifiedFABWrapper"), { ssr: false });
const AchievementUnlockPortal = dynamic(
  () => import("@/components/achievements/UnlockAnimation").then(m => ({ default: m.AchievementUnlockPortal })),
  { ssr: false },
);

export default function DashboardOverlays() {
  return (
    <>
      <UnifiedFABWrapper />
      <InstallPrompt />
      <AchievementUnlockPortal />
      <WelcomeTour />
    </>
  );
}
