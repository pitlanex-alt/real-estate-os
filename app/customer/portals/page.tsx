import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutCustomer } from "@/app/customer/actions";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { customerPortalPath } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";
import { KelvoLogo } from "@/app/components/KelvoBrand";

const roleLabels = { seller: "Seljandagátt", co_owner: "Seljandagátt", accepted_buyer: "Kaupendagátt" } as const;

export default async function CustomerPortalChooserPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "customer");
  if (!resolution.authenticated) redirect("/customer/login");
  if (!resolution.customerDestinations.length) redirect(resolution.destination ?? "/customer/access-denied");
  if (resolution.customerDestinations.length === 1) redirect(customerPortalPath(resolution.customerDestinations[0]));

  return <main className="min-h-screen bg-[var(--background)] px-5 py-10 sm:py-14">
    <section className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <KelvoLogo className="w-[108px]" priority />
        <form action={logoutCustomer}><button className="mo-button mo-button-text min-h-11 px-2 text-[12px]">Skrá út</button></form>
      </div>
      <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Viðskiptavinagátt</p>
      <h1 className="mt-3 text-[29px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">Veldu eign</h1>
      <p className="mt-3 text-[14px] text-[var(--text-secondary)]">Þú hefur aðgang að fleiri en einni gátt.</p>
      <ul className="mt-8 grid gap-3">
        {resolution.customerDestinations.map((destination) => <li key={`${destination.transactionId}-${destination.role}`}>
          <Link href={customerPortalPath(destination)} className="kelvo-card mo-hover-row flex min-h-24 items-center justify-between gap-5 px-5 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-[#7d9961]/60">
            <div><p className="text-[15px] font-semibold text-[var(--text-primary)]">{destination.address}</p><p className="mt-1.5 text-[12px] text-[var(--text-secondary)]">{destination.postalCode} {destination.municipality}</p></div>
            <span className="kelvo-status-progress mo-hover-accent rounded-full px-3 py-1.5 text-[11px] font-semibold">{roleLabels[destination.role]}</span>
          </Link>
        </li>)}
      </ul>
    </section>
  </main>;
}
