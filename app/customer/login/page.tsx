import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerLoginForm } from "./CustomerLoginForm";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";
import { KelvoLogo } from "@/app/components/KelvoBrand";

export const metadata: Metadata = { title: "Innskráning í gátt — Kelvo" };

export default async function CustomerLoginPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "customer");
  if (resolution.authenticated && resolution.destination) {
    redirect(resolution.destination);
  }

  return <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10"><section className="kelvo-card w-full max-w-sm p-7 sm:p-9"><KelvoLogo className="w-[116px]" priority /><p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Viðskiptavinagátt</p><h1 className="mt-3 text-[27px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Skráðu þig inn</h1><p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Notaðu aðganginn sem fasteignasalinn hefur tengt við eignina þína.</p><CustomerLoginForm /></section></main>;
}
