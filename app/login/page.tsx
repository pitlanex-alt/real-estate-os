import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

export const metadata: Metadata = {
  title: "Innskráning — Mó",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "internal");

  if (resolution.authenticated && resolution.destination) {
    redirect(resolution.destination);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111412] px-5 text-[#f3f1ea]">
      <section className="w-full max-w-sm border-y border-white/[0.08] py-9" aria-labelledby="login-heading">
        <div className="flex items-center gap-3">
          <span className="relative grid size-8 place-items-center rounded-full border border-white/12 bg-[#171b18]">
            <span className="absolute h-3.5 w-px -rotate-45 bg-[#9caf9a]" />
            <span className="absolute h-3.5 w-px rotate-45 bg-[#687b68]" />
          </span>
          <span className="text-[20px] font-semibold tracking-[-0.04em]">Mó</span>
        </div>
        <h1 id="login-heading" className="mt-8 text-[24px] font-semibold tracking-[-0.03em]">Innskráning</h1>
        <p className="mt-2 text-[12px] leading-5 text-[#7a827c]">Einföld innskráning fyrir fyrsta bakendafasa.</p>
        <LoginForm />
      </section>
    </main>
  );
}
