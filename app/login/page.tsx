import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

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
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[12px] border border-[#bfd747] bg-[var(--accent)] text-[15px] font-bold text-[var(--accent-text)]">K</span>
          <span className="text-[20px] font-bold tracking-[-0.045em] text-[var(--text-primary)]">Kelvo</span>
        </div>
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Fyrir starfsfólk</p>
        <h1 id="login-heading" className="mt-3 text-[27px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Innskráning</h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Skráðu þig inn í vinnusvæði fasteignasölunnar.</p>
        <LoginForm />
      </section>
    </main>
  );
}
