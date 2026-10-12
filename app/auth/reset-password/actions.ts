"use server";

import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type ResetRequestState = { sent: boolean; error: string | null };
export type PasswordUpdateState = { error: string | null };

export async function requestPasswordReset(_state: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { sent: false, error: "Sláðu inn gilt netfang." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/auth/reset-password/confirm", getSiteUrl()).toString() });
  return { sent: true, error: null };
}

export async function updatePassword(_state: PasswordUpdateState, formData: FormData): Promise<PasswordUpdateState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (password.length < 10) return { error: "Lykilorðið þarf að vera að minnsta kosti 10 stafir." };
  if (password !== confirmation) return { error: "Lykilorðin passa ekki saman." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Endurstillingartengillinn er ógildur eða útrunninn." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Ekki tókst að uppfæra lykilorðið. Reyndu aftur." };
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reset=success");
}
