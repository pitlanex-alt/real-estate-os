import "server-only";
import { redirect } from "next/navigation";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

export function safeInternalDestination(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/properties";
  if (candidate.startsWith("/auth/") || candidate.startsWith("/customer/") || candidate.startsWith("/buyer/") || candidate.startsWith("/seller/")) return "/properties";
  return candidate;
}

export async function getInternalMfaContext() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "internal");
  if (!resolution.authenticated) redirect("/login");
  if (!resolution.internalIdentity) redirect(resolution.destination ?? "/customer/access-denied");

  const [aalResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (aalResult.error || factorsResult.error) redirect("/login");

  return {
    identity: resolution.internalIdentity,
    aal: aalResult.data,
    factors: factorsResult.data,
  };
}
