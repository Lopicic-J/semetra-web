import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileHeader from "@/components/sidebar/MobileHeader";
import I18nWrapper from "@/components/providers/I18nWrapper";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <I18nWrapper>
      <div className="flex h-screen bg-surface-50 overflow-hidden">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header — visible only on mobile */}
          <MobileHeader />

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </I18nWrapper>
  );
}
