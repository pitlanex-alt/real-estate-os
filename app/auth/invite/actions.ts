"use server";

import { redirect } from "next/navigation";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

export type InvitePasswordState = { error: string | null };

export async function setInvitePassword(
  _state: InvitePasswordState,
  formData: FormData,
): Promise<InvitePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (password.length < 10) return { error: "Lykilorðið þarf að vera að minnsta kosti 10 stafir." };
  if (password !== confirmation) return { error: "Lykilorðin passa ekki saman." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Boðstengillinn er ógildur eða útrunninn." };
  if (!user.invited_at) return { error: "Þessi aðgangur var ekki stofnaður með teymisboði." };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) return { error: "Enginn virkur teymisaðgangur fannst fyrir boðið." };

  const { error } = await supabase.auth.updateUser({
    password,
    data: { invite_accepted_at: new Date().toISOString() },
  });
  if (error) return { error: "Ekki tókst að vista lykilorðið. Reyndu aftur." };

  const resolution = await resolvePostAuthDestination(supabase, "internal");
  redirect(resolution.destination ?? "/properties");
}
