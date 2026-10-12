import type { ReactNode } from "react";
import { KelvoLogo } from "@/app/components/KelvoBrand";
import { logoutInternal } from "@/app/login/logout";

export function MfaCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 text-[var(--text-primary)]">
      <section className="kelvo-card w-full max-w-sm p-7 sm:p-9">
        <KelvoLogo className="w-[116px]" priority />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">{eyebrow}</p>
        <h1 className="mt-3 text-[27px] font-bold tracking-[-0.04em]">{title}</h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
        {children}
        <form action={logoutInternal} className="mt-5 text-center"><button type="submit" className="mo-button-text min-h-10 px-2 text-[11px]">Skrá út og nota annan aðgang</button></form>
      </section>
    </main>
  );
}
