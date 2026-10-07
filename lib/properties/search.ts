import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>) { return Array.isArray(value) ? value[0] ?? null : value; }

export type PropertySearchOption = { href: string; address: string; location: string; sellers: string[] };

export async function getPropertySearchOptions(supabase: Client, organizationId: string): Promise<PropertySearchOption[]> {
  const { data, error } = await supabase.from("transactions").select(`
    property:properties!transactions_property_id_fkey(slug,address_line,postal_code,municipality),
    parties:transaction_parties!transaction_parties_transaction_id_fkey(role,contact:contacts!transaction_parties_contact_id_fkey(full_name))
  `).eq("organization_id", organizationId).order("started_at", { ascending: false });
  if (error) { console.error("Unable to load property search", error); return []; }
  return (data ?? []).flatMap((row) => {
    const property = one(row.property as Relation<{ slug: string; address_line: string; postal_code: string; municipality: string }>);
    if (!property) return [];
    const parties = (row.parties ?? []) as Array<{ role: string; contact: Relation<{ full_name: string }> }>;
    return [{ href: `/properties/${property.slug}`, address: property.address_line, location: `${property.postal_code} ${property.municipality}`, sellers: parties.filter((party) => party.role === "seller" || party.role === "co_owner").flatMap((party) => { const contact = one(party.contact); return contact ? [contact.full_name] : []; }) }];
  });
}
