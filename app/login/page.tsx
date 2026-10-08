import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { KelvoLogo } from "@/app/components/KelvoBrand";

export const metadata: Metadata = {
  title: "Innskráning — Kelvo",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "internal");

  if (resolution.authenticated && resolution.destination) {
    redirect(resolution.destination);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 text-[var(--text-primary)]">
      <section className="kelvo-card w-full max-w-sm p-7 sm:p-9" aria-labelledby="login-heading">
        <KelvoLogo className="w-[116px]" priority />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Fyrir starfsfólk</p>
        <h1 id="login-heading" className="mt-3 text-[27px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Innskráning</h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Skráðu þig inn í vinnusvæði fasteignasölunnar.</p>
        <LoginForm />
      </section>
    </main>
  );
}
