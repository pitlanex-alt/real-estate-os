import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerLoginForm } from "./CustomerLoginForm";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Innskráning í gátt — Mó" };

export default async function CustomerLoginPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "customer");
  if (resolution.authenticated && resolution.destination) {
    redirect(resolution.destination);
  }

  return <main className="grid min-h-screen place-items-center bg-[#121512] px-5 text-[#f3f1ea]"><section className="w-full max-w-sm border-y border-white/[0.08] py-10"><div className="flex items-center gap-3"><span className="relative grid size-8 place-items-center rounded-full border border-white/10 bg-[#191d19]"><span className="absolute h-3.5 w-px -rotate-45 bg-[#9caf9a]" /><span className="absolute h-3.5 w-px rotate-45 bg-[#687b68]" /></span><span className="text-[20px] font-semibold tracking-[-0.04em]">Mó</span></div><p className="mt-8 text-[11px] font-medium uppercase tracking-[0.13em] text-[#819181]">Viðskiptavinagátt</p><h1 className="mt-3 text-[25px] font-semibold tracking-[-0.035em]">Skráðu þig inn</h1><p className="mt-3 text-[13px] leading-6 text-[#7a827c]">Notaðu aðganginn sem fasteignasalinn hefur tengt við eignina þína.</p><CustomerLoginForm /></section></main>;
}
