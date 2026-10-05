import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutCustomer } from "@/app/customer/actions";
import { customerPortalPath } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

const roleLabels = { seller: "Seljandagátt", co_owner: "Seljandagátt", accepted_buyer: "Kaupendagátt" } as const;

export default async function CustomerPortalChooserPage() {
  const supabase = await createClient();
  const resolution = await resolvePostAuthDestination(supabase, "customer");
  if (!resolution.authenticated) redirect("/customer/login");
  if (!resolution.customerDestinations.length) {
    redirect(resolution.destination ?? "/customer/access-denied");
  }
  if (resolution.customerDestinations.length === 1) {
    redirect(customerPortalPath(resolution.customerDestinations[0]));
  }

  return <main className="min-h-screen bg-[#121512] px-5 py-14 text-[#f3f1ea]"><section className="mx-auto w-full max-w-2xl"><div className="flex items-center justify-between border-b border-white/[0.08] pb-7"><div className="flex items-center gap-3"><span className="relative grid size-8 place-items-center rounded-full border border-white/10 bg-[#191d19]"><span className="absolute h-3.5 w-px -rotate-45 bg-[#9caf9a]" /><span className="absolute h-3.5 w-px rotate-45 bg-[#687b68]" /></span><span className="text-[20px] font-semibold tracking-[-0.04em]">Mó</span></div><form action={logoutCustomer}><button className="min-h-11 px-2 text-[12px] text-[#727b74] hover:text-[#b8beb9]">Skrá út</button></form></div><p className="mt-10 text-[11px] font-medium uppercase tracking-[0.13em] text-[#819181]">Viðskiptavinagátt</p><h1 className="mt-3 text-[27px] font-semibold tracking-[-0.035em]">Veldu eign</h1><p className="mt-3 text-[14px] text-[#7f8781]">Þú hefur aðgang að fleiri en einni gátt.</p><ul className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">{resolution.customerDestinations.map((destination) => <li key={`${destination.transactionId}-${destination.role}`}><Link href={customerPortalPath(destination)} className="flex min-h-20 items-center justify-between gap-5 py-4"><div><p className="text-[15px] font-medium text-[#e1dfd8]">{destination.address}</p><p className="mt-1.5 text-[12px] text-[#747c76]">{destination.postalCode} {destination.municipality}</p></div><span className="text-[12px] font-medium text-[#91a18f]">{roleLabels[destination.role]}</span></Link></li>)}</ul></section></main>;
}
