import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileHeader from "@/components/sidebar/MobileHeader";
import I18nWrapper from "@/components/providers/I18nWrapper";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import OfflineBanner from "@/components/pwa/OfflineBanner";
import { AchievementUnlockPortal } from "@/components/achievements/UnlockAnimation";
import { VerificationBanner } from "@/components/ui/VerificationBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <I18nWrapper>
      <OfflineBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Zum Hauptinhalt springen
      </a>
      <div className="flex h-screen bg-surface-50 overflow-hidden">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header — visible only on mobile */}
          <MobileHeader />

          <VerificationBanner />
          <main id="main-content" className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <InstallPrompt />
      <AchievementUnlockPortal />
    </I18nWrapper>
  );
}
