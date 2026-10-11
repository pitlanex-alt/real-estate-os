import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import {
  formatIcelandicDateWithYear,
  formatIcelandicTime,
} from "@/lib/datetime/iceland";
import {
  customerOfferStatusLabel,
  formatIsk,
  type OfferStatus,
} from "@/lib/offers/model";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type OfferRow = {
  id: string;
  amount_isk: number;
  valid_until: string;
  status: OfferStatus;
  created_at: string;
  buyer: Relation<{ full_name: string }>;
  transaction: Relation<{
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

function statusClass(status: OfferStatus) {
  if (["accepted", "agent_approved", "sent_to_seller"].includes(status)) {
    return "bg-[#e8f0e3] text-[#526747]";
  }
  if (["rejected", "withdrawn", "expired"].includes(status)) {
    return "bg-[#f7e7e5] text-[#914b45]";
  }
  if (["submitted", "change_requested", "seller_intent_recorded"].includes(status)) {
    return "bg-[#f6eddc] text-[#7b5b29]";
  }
  return "bg-[#f0f2ef] text-[#747b73]";
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
        property:properties!transactions_property_id_fkey(slug, address_line, postal_code, municipality)
      )
    `)
    .eq("organization_id", identity.organizationId)
    .order("created_at", { ascending: false });

  if (error) console.error("Unable to load offers", error);
  const offers = (data ?? []) as unknown as OfferRow[];

  return (
    <AppShell activeItem="Tilboð" identity={identity}>
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
        ) : (
          <section className="kelvo-card mt-6 overflow-hidden px-3 sm:px-4">
            {offers.map((offer) => {
              const transaction = one(offer.transaction);
              const property = one(transaction?.property ?? null);
              const buyer = one(offer.buyer);
              if (!property) return null;

              return (
                <Link
                  key={offer.id}
                  href={`/properties/${property.slug}/offers/${offer.id}?from=offers`}
                  className="group grid min-h-[84px] items-center gap-3 border-b border-black/[0.06] px-2 py-4 last:border-b-0 sm:grid-cols-[minmax(190px,1.35fr)_minmax(150px,.8fr)_minmax(160px,1fr)_auto] sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                      {property.address_line}
                    </p>
                    <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">
                      {property.postal_code} {property.municipality}
                    </p>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                      {formatIsk(Number(offer.amount_isk))}
                    </p>
                    <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">
                      {buyer?.full_name ?? "Kaupandi"}
                    </p>
                  </div>
                  <div>
                    <span className={`${statusClass(offer.status)} inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold`}>
                      {customerOfferStatusLabel(offer.status)}
                    </span>
                    {!['accepted', 'rejected', 'withdrawn', 'expired', 'superseded'].includes(offer.status) && (
                      <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                        Gildir til {formatIcelandicDateWithYear(offer.valid_until)} · {formatIcelandicTime(offer.valid_until)}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={15} className="justify-self-end text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]" />
                </Link>
              );
            })}
            {!offers.length && (
              <p className="py-12 text-center text-[12px] text-[var(--text-secondary)]">
                Engin tilboð hafa borist.
              </p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
