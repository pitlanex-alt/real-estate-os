"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInternalMfaGate, resolvePostAuthDestination } from "@/lib/auth/post-auth";

export type LoginState = { error: string | null };

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Sláðu inn netfang og lykilorð." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Netfang eða lykilorð er rangt." };
  }

  const resolution = await resolvePostAuthDestination(supabase, "internal");
  if (resolution.internalIdentity) {
    const mfaGate = await getInternalMfaGate(supabase);
    if (mfaGate) redirect(mfaGate);
  }
  redirect(resolution.destination ?? "/customer/access-denied");
}
