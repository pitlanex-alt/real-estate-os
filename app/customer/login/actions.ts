"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

export type CustomerLoginState = { error: string | null };

export async function customerLogin(_state: CustomerLoginState, formData: FormData): Promise<CustomerLoginState> {
  const email = formData.get("email"); const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) return { error: "Sláðu inn netfang og lykilorð." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Innskráning mistókst. Athugaðu netfang og lykilorð." };
  const resolution = await resolvePostAuthDestination(supabase, "customer");
  redirect(resolution.destination ?? "/customer/access-denied");
}
