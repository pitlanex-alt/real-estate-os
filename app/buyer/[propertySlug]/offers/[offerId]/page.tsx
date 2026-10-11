import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { formatIcelandicDate, formatOfferValidity } from "@/lib/datetime/iceland";
import { getBuyerOffer } from "@/lib/offers/detail";
import { customerOfferStatusLabel, formatIsk, offerConditionLabel } from "@/lib/offers/model";
import { getCustomerTransactionOffers } from "@/lib/portal/customer";
import { getBuyerPortalContext } from "@/lib/portal/context";

export default async function BuyerOfferPage({ params }: { params: Promise<{ propertySlug: string; offerId: string }> }) {
  const { propertySlug, offerId } = await params;
  const context = await getBuyerPortalContext(propertySlug);
  if (!context) return <PortalAccessDenied />;

  const [offer, availableOffers] = await Promise.all([
    getBuyerOffer(offerId, context.supabase),
    getCustomerTransactionOffers(context.destination.transactionId, context.supabase),
  ]);
  if (offer.denied) return <PortalAccessDenied />;
  if (!offer.data || availableOffers.error || !availableOffers.data.some((item) => item.id === offerId)) notFound();

  const accepted = offer.data.status === "accepted";
  const validity = formatOfferValidity(offer.data.validUntil);
  return <>
    <div className="mx-auto max-w-[920px] px-4 py-8 sm:px-6 sm:py-10">
      <Link href={`/buyer/${propertySlug}`} className="mo-button mo-button-text inline-flex min-h-11 items-center gap-1 text-[12px]"><ChevronLeft size={14} />{context.summary.property.address}</Link>
      <section className="kelvo-card mt-4 p-6 sm:p-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Tilboð þitt</p>
          <h1 className="mt-3 text-[34px] font-bold tracking-[-0.045em] text-[var(--text-primary)] sm:text-[40px]">{formatIsk(offer.data.amountIsk)}</h1>
          <p className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${accepted ? "kelvo-status-success" : "kelvo-status-progress"}`}>{customerOfferStatusLabel(offer.data.status)}</p>
        </header>
        <dl className="mt-7 grid gap-px overflow-hidden rounded-[14px] border border-black/[0.06] bg-black/[0.06] sm:grid-cols-3">
          <div className="bg-white p-4"><dt className="text-[11px] text-[var(--text-muted)]">{accepted ? "Niðurstaða" : validity.expired ? "Gildistími" : "Gildir til"}</dt><dd className={`mt-2 text-[14px] font-medium ${validity.expired ? "text-[#914b45]" : "text-[#343934]"}`}>{accepted ? "Samþykkt" : validity.label.replace(/^Gildir til |^Gildistími /, "")}</dd></div>
          <div className="bg-white p-4"><dt className="text-[11px] text-[var(--text-muted)]">Afhending</dt><dd className="mt-2 text-[14px] font-medium text-[#343934]">{formatIcelandicDate(`${offer.data.requestedHandoverDate}T12:00:00Z`)}</dd></div>
          <div className="bg-white p-4"><dt className="text-[11px] text-[var(--text-muted)]">Skilyrði</dt><dd className="mt-2 text-[14px] font-medium text-[#343934]">{offer.data.conditions.map((condition) => offerConditionLabel(condition.type)).join(", ") || "Engin"}</dd></div>
        </dl>
        <section className="mt-6 rounded-[14px] bg-[var(--surface-accent)] px-4 py-4 text-[13px] text-[#536451]"><Check size={14} className="mr-2 inline" />{accepted ? "Tilboð samþykkt. Fasteignasalinn mun hafa samband vegna næstu skrefa." : "Tilboðið er í formlegu vinnuflæði fasteignasala."}</section>
        {accepted && <p className="mt-4 text-[11px] leading-5 text-[var(--text-secondary)]">Samþykkt tilboð þýðir ekki að kaupsamningur hafi verið stofnaður eða undirritaður.</p>}
      </section>
    </div>
  </>;
}
