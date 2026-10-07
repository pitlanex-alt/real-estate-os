import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { formatIcelandicDate } from "@/lib/datetime/iceland";
import { formatIsk } from "@/lib/offers/model";
import { createClient } from "@/lib/supabase/server";
import { ContactEditor } from "./ContactEditor";

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;

type PropertyLink = { slug: string; address_line: string };
type TransactionLink = { id: string; stage?: string; property: Relation<PropertyLink> };

export default async function ContactPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const [contactResult, partiesResult, guestsResult, offersResult] = await Promise.all([
    supabase.from("contacts").select("id,full_name,email,phone").eq("id", contactId).eq("organization_id", identity.organizationId).maybeSingle(),
    supabase.from("transaction_parties").select("role,transaction:transactions!transaction_parties_transaction_id_fkey(id,stage,property:properties!transactions_property_id_fkey(slug,address_line))").eq("contact_id", contactId),
    supabase.from("viewing_guests").select("attendance,interest,viewing:viewings!viewing_guests_viewing_id_fkey(starts_at,transaction:transactions!viewings_transaction_id_fkey(id,property:properties!transactions_property_id_fkey(slug,address_line)))").eq("contact_id", contactId).order("created_at", { ascending: false }),
    supabase.from("offers").select("id,amount_isk,status,created_at,transaction:transactions!offers_transaction_id_fkey(id,property:properties!transactions_property_id_fkey(slug,address_line))").eq("buyer_contact_id", contactId).order("created_at", { ascending: false }),
  ]);
  if (contactResult.error || !contactResult.data) notFound();

  const transactionIds = new Set<string>();
  for (const row of partiesResult.data ?? []) {
    const transaction = one(row.transaction as Relation<TransactionLink>);
    if (transaction) transactionIds.add(transaction.id);
  }
  for (const row of guestsResult.data ?? []) {
    const viewing = one(row.viewing as Relation<{ starts_at: string; transaction: Relation<TransactionLink> }>);
    const transaction = one(viewing?.transaction ?? null);
    if (transaction) transactionIds.add(transaction.id);
  }
  for (const row of offersResult.data ?? []) {
    const transaction = one(row.transaction as Relation<TransactionLink>);
    if (transaction) transactionIds.add(transaction.id);
  }
  const activityResult = transactionIds.size
    ? await supabase.from("activity_events").select("id,summary,created_at").in("transaction_id", [...transactionIds]).order("created_at", { ascending: false }).limit(8)
    : { data: [], error: null };

  const contact = contactResult.data;
  return <AppShell activeItem="Viðskiptavinir" identity={identity}><div className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
    <Link href="/contacts" className="mo-button mo-button-text min-h-11 text-[11px]">Viðskiptavinir</Link>
    <header className="mt-3 border-b border-white/[0.07] pb-7"><h1 className="text-[27px] font-semibold">{contact.full_name}</h1></header>
    <ContactEditor contact={{ id: contact.id, name: contact.full_name, email: contact.email, phone: contact.phone }} canEdit={identity.role !== "viewer"} />
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <section><h2 className="text-[15px] font-semibold">Viðskipti</h2><div className="mt-4 border-t border-white/[0.07]">{(partiesResult.data ?? []).map((row, index) => { const transaction = one(row.transaction as Relation<TransactionLink>); const property = one(transaction?.property ?? null); return property ? <Link key={`${transaction?.id}-${index}`} href={`/properties/${property.slug}`} className="mo-hover-row block border-b border-white/[0.07] py-4"><p className="text-[12px]">{property.address_line}</p><p className="mt-1 text-[10px] text-[#747c76]">{row.role} · {transaction?.stage}</p></Link> : null; })}</div></section>
      <section><h2 className="text-[15px] font-semibold">Skoðanir</h2><div className="mt-4 border-t border-white/[0.07]">{(guestsResult.data ?? []).map((row, index) => { const viewing = one(row.viewing as Relation<{ starts_at: string; transaction: Relation<TransactionLink> }>); const transaction = one(viewing?.transaction ?? null); const property = one(transaction?.property ?? null); return <div key={index} className="border-b border-white/[0.07] py-4 text-[11px]"><p>{property?.address_line ?? "Eign"}</p><p className="mt-1 text-[#747c76]">{viewing ? formatIcelandicDate(viewing.starts_at) : "—"} · {row.attendance} · {row.interest}</p></div>; })}</div></section>
      <section><h2 className="text-[15px] font-semibold">Tilboð</h2><div className="mt-4 border-t border-white/[0.07]">{(offersResult.data ?? []).map((row) => { const transaction = one(row.transaction as Relation<TransactionLink>); const property = one(transaction?.property ?? null); return <Link key={row.id} href={property ? `/properties/${property.slug}/offers/${row.id}` : "#"} className="mo-hover-row block border-b border-white/[0.07] py-4"><p className="text-[12px]">{formatIsk(Number(row.amount_isk))}</p><p className="mt-1 text-[10px] text-[#747c76]">{property?.address_line ?? "Eign"} · {row.status}</p></Link>; })}</div></section>
      <section><h2 className="text-[15px] font-semibold">Nýleg virkni</h2><div className="mt-4 border-t border-white/[0.07]">{(activityResult.data ?? []).map((event) => <div key={event.id} className="border-b border-white/[0.07] py-4"><p className="text-[11px] text-[#c4c6bf]">{event.summary}</p><p className="mt-1 text-[10px] text-[#747c76]">{formatIcelandicDate(event.created_at)}</p></div>)}{!activityResult.data?.length && <p className="border-b border-white/[0.07] py-4 text-[11px] text-[#747c76]">Engin nýleg virkni.</p>}</div></section>
    </div>
  </div></AppShell>;
}
