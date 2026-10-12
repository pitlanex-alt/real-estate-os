import { requireInternalIdentity } from "@/lib/auth/post-auth";
import type { OfferStatus } from "@/lib/offers/model";
import { createClient } from "@/lib/supabase/server";
import { OffersList, type OfferListItem } from "./OffersList";

type Relation<T> = T | T[] | null;

type OfferRow = {
  id: string;
  amount_isk: number;
  valid_until: string;
  status: OfferStatus;
  created_at: string;
  buyer: Relation<{ full_name: string }>;
  transaction: Relation<{
    stage: string;
    property: Relation<{
      slug: string;
      address_line: string;
      postal_code: string;
      municipality: string;
    }>;
  }>;
};

function one<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function OffersPage() {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data, error } = await supabase
    .from("offers")
    .select(`
      id,
      amount_isk,
      valid_until,
      status,
      created_at,
      buyer:contacts!offers_buyer_contact_id_fkey(full_name),
      transaction:transactions!offers_transaction_id_fkey(
        stage,
        property:properties!transactions_property_id_fkey(slug, address_line, postal_code, municipality)
      )
    `)
    .eq("organization_id", identity.organizationId)
    .order("created_at", { ascending: false });

  if (error) console.error("Unable to load offers", error);
  const offers = (data ?? []) as unknown as OfferRow[];
  const items = offers.flatMap((offer): OfferListItem[] => {
    const transaction = one(offer.transaction);
    const property = one(transaction?.property ?? null);
    if (!transaction || !property) return [];
    return [{ id: offer.id, amountIsk: Number(offer.amount_isk), validUntil: offer.valid_until, status: offer.status, buyerName: one(offer.buyer)?.full_name ?? "Kaupandi", transactionStage: transaction.stage, property: { slug: property.slug, address: property.address_line, postalCode: property.postal_code, municipality: property.municipality } }];
  });

  return (
    <>
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12">
        <header>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
            Tilboð
          </h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Yfirlit yfir tilboð í virkum eignaviðskiptum.
          </p>
        </header>

        {error ? (
          <p className="mt-6 rounded-[14px] border border-[#b75e56]/20 bg-[#f7e7e5] px-4 py-3 text-[#914b45]">
            Ekki tókst að sækja tilboð.
          </p>
        ) : <OffersList offers={items} nowIso={new Date().toISOString()} />}
      </div>
    </>
  );
}
