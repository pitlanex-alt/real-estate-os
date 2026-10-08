import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { logoutCustomer } from "@/app/customer/actions";
import { Button } from "@/app/components/ui/Button";
import { KelvoLogo } from "@/app/components/KelvoBrand";

function CustomerBrand({ homeHref, label }: { homeHref: string; label: string }) {
  return (
    <Link href={homeHref} className="flex items-center" aria-label={label}>
      <KelvoLogo className="w-[100px] sm:w-[108px]" priority />
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <CustomerBrand homeHref={homeHref} label={`Kelvo ${portalLabel.toLowerCase()}`} />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{customerName}</p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{customerRole}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[var(--mint)] text-[11px] font-bold tracking-wide text-[#3f594c] ring-1 ring-inset ring-black/[0.05]">
              {customerInitials}
            </span>
            <form action={logoutCustomer}>
              <Button type="submit" variant="icon" size="icon" aria-label="Skrá út" title="Skrá út">
                <LogOut size={17} strokeWidth={1.7} />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-black/[0.06] bg-white/50">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-7 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Kelvo · {portalLabel}</span>
          <span>Upplýsingar uppfærðar í dag kl. 12:14</span>
        </div>
      </footer>
    </div>
  );
}
