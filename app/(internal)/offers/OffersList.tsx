"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchInput } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import { formatOfferValidity } from "@/lib/datetime/iceland";
import { customerOfferStatusLabel, formatIsk, type OfferStatus } from "@/lib/offers/model";

export type OfferListItem = {
  id: string;
  amountIsk: number;
  validUntil: string;
  status: OfferStatus;
  buyerName: string;
  transactionStage: string;
  property: { slug: string; address: string; postalCode: string; municipality: string };
};

const filters = [
  { value: "active", label: "Virkar" },
  { value: "accepted", label: "Samþykkt" },
  { value: "rejected", label: "Hafnað" },
  { value: "expired", label: "Útrunnin" },
  { value: "completed", label: "Lokið" },
  { value: "all", label: "Öll" },
];

const terminalStatuses = ["accepted", "rejected", "withdrawn", "expired", "superseded"];

function statusClass(status: OfferStatus) {
  if (["accepted", "agent_approved", "sent_to_seller"].includes(status)) return "bg-[#e8f0e3] text-[#526747]";
  if (["rejected", "withdrawn", "expired"].includes(status)) return "bg-[#f7e7e5] text-[#914b45]";
  if (["submitted", "change_requested", "seller_intent_recorded"].includes(status)) return "bg-[#f6eddc] text-[#7b5b29]";
  return "bg-[#f0f2ef] text-[#747b73]";
}

export function OffersList({ offers, nowIso }: { offers: OfferListItem[]; nowIso: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("is-IS");
    return offers.filter((offer) => {
      const completedTransaction = ["completed", "cancelled"].includes(offer.transactionStage);
      const expired = offer.status === "expired" || (!terminalStatuses.includes(offer.status) && new Date(offer.validUntil).getTime() < now.getTime());
      const matchesFilter = filter === "all"
        || (filter === "completed" && completedTransaction)
        || (!completedTransaction && filter === "accepted" && offer.status === "accepted")
        || (!completedTransaction && filter === "rejected" && offer.status === "rejected")
        || (!completedTransaction && filter === "expired" && expired)
        || (!completedTransaction && filter === "active" && !terminalStatuses.includes(offer.status) && !expired);
      const matchesQuery = !normalized || `${offer.property.address} ${offer.buyerName}`.toLocaleLowerCase("is-IS").includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, now, offers, query]);

  return <>
    <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(240px,1fr)_190px]">
      <SearchInput controlSize="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Leita að eign eða kaupanda..." aria-label="Leita að eign eða kaupanda" />
      <Select ariaLabel="Sía tilboð" value={filter} onChange={setFilter} options={filters} size="compact" />
    </div>
    <section className="kelvo-card mt-3 overflow-hidden px-3 sm:px-4">
      {filtered.map((offer) => {
        const validity = formatOfferValidity(offer.validUntil, now);
        return <Link key={offer.id} href={`/properties/${offer.property.slug}/offers/${offer.id}?from=offers`} className="group grid min-h-[84px] items-center gap-3 border-b border-black/[0.06] px-2 py-4 last:border-b-0 sm:grid-cols-[minmax(190px,1.35fr)_minmax(150px,.8fr)_minmax(160px,1fr)_auto] sm:gap-6">
          <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{offer.property.address}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{offer.property.postalCode} {offer.property.municipality}</p></div>
          <div><p className="text-[14px] font-semibold text-[var(--text-primary)]">{formatIsk(offer.amountIsk)}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{offer.buyerName}</p></div>
          <div><span className={`${statusClass(offer.status)} inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold`}>{customerOfferStatusLabel(offer.status)}</span>{!terminalStatuses.includes(offer.status) && <p className={`mt-1.5 text-[10px] ${validity.expired ? "text-[#914b45]" : "text-[var(--text-secondary)]"}`}>{validity.label}</p>}</div>
          <ChevronRight size={15} className="justify-self-end text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]" />
        </Link>;
      })}
      {!filtered.length && <p className="py-12 text-center text-[12px] text-[var(--text-secondary)]">Engin tilboð fundust.</p>}
    </section>
  </>;
}
