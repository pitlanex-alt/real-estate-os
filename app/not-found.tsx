import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KelvoLogo } from "@/app/components/KelvoBrand";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 text-[var(--text-primary)]">
      <section className="kelvo-card w-full max-w-[520px] p-7 sm:p-10">
        <KelvoLogo className="w-[108px]" priority />
        <div className="mt-9 border-t border-black/[0.06] pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667d5d]">
            SÍÐAN FANNST EKKI
          </p>
          <h1 className="mt-3 text-[28px] font-bold tracking-[-0.04em] sm:text-[32px]">
            Síðan fannst ekki
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-6 text-[var(--text-secondary)]">
            Síðan sem þú ert að leita að er ekki til eða þú hefur ekki aðgang að henni.
          </p>
          <Link
            href="/"
            className="mo-button mo-button-secondary mt-7 inline-flex min-h-11 items-center gap-2 px-4 text-[13px] font-semibold"
          >
            <ArrowLeft size={15} />
            Til baka
          </Link>
        </div>
      </section>
    </main>
  );
}
