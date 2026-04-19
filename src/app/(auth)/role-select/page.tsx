import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RolePicker from "./RolePicker";

export const metadata = {
  title: "Rolle wählen | Semetra",
  description: "Wähle deine Rolle, um dein Semetra-Erlebnis zu personalisieren.",
};

export default async function RoleSelectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_confirmed, user_role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role_confirmed) {
    redirect(profile.onboarding_completed ? "/dashboard" : "/onboarding");
  }

  return <RolePicker />;
}
