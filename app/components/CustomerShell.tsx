import type { ReactNode } from "react";
import Link from "next/link";
import { logoutCustomer } from "@/app/customer/actions";

function CustomerBrand({ homeHref, label }: { homeHref: string; label: string }) {
  return (
    <Link href={homeHref} className="flex items-center gap-3" aria-label={label}>
      <span className="relative grid size-8 place-items-center rounded-full border border-white/10 bg-[#191d19]">
        <span className="absolute h-3.5 w-px -rotate-45 bg-[#9caf9a]" />
        <span className="absolute h-3.5 w-px rotate-45 bg-[#687b68]" />
      </span>
      <span className="text-[20px] font-semibold tracking-[-0.04em] text-[#f3f1ea]">Mó</span>
    </Link>
  );
}

export function CustomerShell({
  children,
  customerName,
  customerInitials,
  customerRole,
  homeHref,
  portalLabel,
}: {
  children: ReactNode;
  customerName: string;
  customerInitials: string;
  customerRole: string;
  homeHref: string;
  portalLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[#121512] text-[#f3f1ea]">
      <header className="border-b border-white/[0.07] bg-[#101310]">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <CustomerBrand homeHref={homeHref} label={`Mó ${portalLabel.toLowerCase()}`} />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium text-[#e5e3dc]">{customerName}</p>
              <p className="mt-1 text-[11px] text-[#767e78]">{customerRole}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#283029] text-[11px] font-semibold tracking-wide text-[#b9c5b6] ring-1 ring-inset ring-white/[0.08]">
              {customerInitials}
            </span>
            <form action={logoutCustomer}>
              <button type="submit" className="mo-button mo-button-text min-h-11 px-2 text-[12px]">Skrá út</button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-7 text-[11px] text-[#626a64] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Mó · {portalLabel}</span>
          <span>Upplýsingar uppfærðar í dag kl. 12:14</span>
        </div>
      </footer>
    </div>
  );
}
