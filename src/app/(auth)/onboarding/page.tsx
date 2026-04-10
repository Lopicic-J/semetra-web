import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingQuestionnaire from "@/components/onboarding/OnboardingQuestionnaire";

export const metadata = {
  title: "Onboarding | Semetra",
  description: "Personalisiere dein Lernerlebnis in 5 Schritten",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if already completed
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return <OnboardingQuestionnaire />;
}
