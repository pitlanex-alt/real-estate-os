"use client";

import { Check, ChevronLeft, Circle, Clock3 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { formatIcelandicDate, formatIcelandicTime } from "@/lib/datetime/iceland";
import { financingStatusLabel, formatIsk, offerConditionLabel, type AgentOfferData, type OfferStatus } from "@/lib/offers/model";
import { approveOfferForSeller, confirmOfferAccepted, rejectOffer, requestOfferChange, sendOfferToSeller } from "../actions";

const statusLabels: Record<OfferStatus, string> = { draft: "Drög", submitted: "Bíður yfirferðar", change_requested: "Breytinga óskað", agent_approved: "Tilbúið fyrir seljanda", sent_to_seller: "Sent seljanda", seller_intent_recorded: "Svar seljanda móttekið", accepted: "Samþykkt", rejected: "Hafnað", withdrawn: "Dregið til baka", expired: "Útrunnið", superseded: "Leyst af hólmi" };

function statusStyle(status: OfferStatus) {
  if (status === "accepted") return "kelvo-status-success";
  if (status === "rejected" || status === "withdrawn" || status === "expired") return "kelvo-status-danger";
  if (status === "submitted" || status === "change_requested") return "kelvo-status-warning";
  return "kelvo-status-progress";
}

export function AgentOfferReview({ offer, propertySlug }: { offer: AgentOfferData; propertySlug: string }) {
  const [status, setStatus] = useState(offer.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const financing = offer.conditions.find((condition) => condition.type === "financing");
  const difference = offer.amountIsk - offer.askingPriceIsk;
  const checklist = [["Kaupandi auðkenndur", offer.review?.buyerIdentified], ["Tengiliðaupplýsingar staðfestar", offer.review?.contactConfirmed], ["Gildistími skráður", offer.review?.validityRecorded], ["Afhendingardagur skráður", offer.review?.handoverRecorded]] as const;

  async function run(action: () => Promise<void>, next: OfferStatus) { setPending(true); setError(null); try { await action(); setStatus(next); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aðgerð mistókst."); } finally { setPending(false); } }

  return <>
    <header>
      <Link href={`/properties/${propertySlug}`} className="mo-button mo-button-text inline-flex min-h-11 items-center gap-1.5 text-[11px] font-medium"><ChevronLeft size={14} />{offer.property}</Link>
      <div className="kelvo-card mt-3 p-6 sm:p-7"><p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#667d5d]">Tilboð {offer.id.slice(0, 8)}</p><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-[34px] font-bold tracking-[-0.045em] text-[var(--text-primary)] sm:text-[40px]">{formatIsk(offer.amountIsk)}</h1><span className={`${statusStyle(status)} rounded-full px-3 py-1.5 text-[10px] font-semibold`}>{statusLabels[status]}</span></div><div className="mt-5 flex flex-wrap gap-5 text-[10.5px] text-[var(--text-secondary)] sm:gap-8"><span>{offer.buyerName}</span><span>{offer.property}</span><span className="rounded-full bg-[#f6eddc] px-2.5 py-1 text-[#7b5b29]"><Clock3 size={11} className="mr-1 inline" />{formatIcelandicDate(offer.validUntil)} · {formatIcelandicTime(offer.validUntil)}</span></div></div>
    </header>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="kelvo-card p-5 sm:p-6"><h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Samantekt tilboðs</h2><dl className="mt-4 border-t border-black/[0.06]">{[["Tilboðsupphæð", formatIsk(offer.amountIsk)], ["Ásett verð", formatIsk(offer.askingPriceIsk)], ["Mismunur", `${difference < 0 ? "−" : "+"}${formatIsk(Math.abs(difference))}`], ["Skilyrði", offer.conditions.map((condition) => offerConditionLabel(condition.type)).join(", ") || "Engin"], ["Staða fjármögnunar", financingStatusLabel(financing?.status ?? null)]].map(([label,value]) => <div key={label} className="grid border-b border-black/[0.06] py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-[10.5px] text-[var(--text-muted)]">{label}</dt><dd className="text-[12px] font-medium text-[#343934]">{value}</dd></div>)}</dl></section>
      <aside className="kelvo-card p-5 sm:p-6"><h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Yfirferð fasteignasala</h2><ul className="mt-4 border-t border-black/[0.06]">{checklist.map(([label,complete]) => <li key={label} className="flex min-h-12 items-center gap-3 border-b border-black/[0.06] text-[11px] text-[#4f5650]">{complete ? <Check size={14} className="text-[#69805f]" /> : <Circle size={13} className="text-[#b98a3f]" />}{label}</li>)}</ul>{offer.review?.financingNeedsConfirmation && <p className="mt-4 rounded-[12px] bg-[#f6eddc] px-3 py-2.5 text-[10.5px] text-[#7b5b29]">Fjármögnun þarf nánari staðfestingu.</p>}</aside>
    </div>

    <section className="kelvo-card mt-5 p-5 sm:p-6">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Aðgerðir</h2><p className="mt-2 text-[10px] text-[var(--text-secondary)]">Innri yfirferð fasteignasala. Viljayfirlýsing seljanda breytir ekki sjálfkrafa niðurstöðu tilboðs.</p>
      <div className="mt-5 flex flex-wrap gap-3">{status === "submitted" && <><Button variant="primary" disabled={pending} onClick={() => void run(() => approveOfferForSeller(offer.id, propertySlug), "agent_approved")} className="min-h-11 px-4 text-[12px] font-semibold">Samþykkja til yfirferðar</Button><Button variant="secondary" disabled={pending} onClick={() => void run(() => requestOfferChange(offer.id, propertySlug, "Staðfesta þarf upplýsingar"), "change_requested")} className="min-h-11 px-4 text-[12px]">Óska eftir breytingu</Button></>}{status === "agent_approved" && <Button variant="primary" disabled={pending} onClick={() => void run(() => sendOfferToSeller(offer.id, propertySlug), "sent_to_seller")} className="min-h-11 px-4 text-[12px] font-semibold">Senda til seljanda</Button>}{status === "sent_to_seller" && <p className="kelvo-status-progress rounded-[12px] px-3 py-2 text-[12px]">Tilboðið hefur verið sent seljanda og bíður svars.</p>}</div>

      {status === "seller_intent_recorded" && offer.latestSellerIntent === "accept" && <div className="mt-6 max-w-2xl rounded-[14px] bg-[var(--surface-accent)] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Seljandi vill samþykkja</p><h3 className="mt-2 text-[16px] font-semibold text-[var(--text-primary)]">Staðfesta samþykkt tilboðs</h3><p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">Þetta skráir samþykkt tilboð í Kelvo og færir innra vinnuflæði í samningsundirbúning. Aðgerðin stofnar ekki og undirritar ekki löglegan kaupsamning.</p><Button variant="primary" disabled={pending} onClick={() => void run(() => confirmOfferAccepted(offer.id, propertySlug), "accepted")} className="mt-5 min-h-11 px-5 text-[12px] font-semibold">Staðfesta samþykkt tilboðs</Button></div>}
      {status === "seller_intent_recorded" && offer.latestSellerIntent !== "accept" && <p className="kelvo-status-warning mt-5 rounded-[12px] px-3 py-2.5 text-[12px]">Nýjasta viljayfirlýsing seljanda: {offer.latestSellerIntent === "reject" ? "hafna" : offer.latestSellerIntent === "counter_offer" ? "ræða móttilboð" : "ekkert svar"}.</p>}
      {!['accepted', 'rejected', 'withdrawn', 'expired', 'superseded', 'draft'].includes(status) && <div className="mt-7 max-w-2xl border-t border-black/[0.06] pt-6"><label className="block text-[11px] text-[var(--text-secondary)]">Ástæða höfnunar <span className="text-[var(--text-muted)]">(valfrjálst)</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} maxLength={1000} className="mo-control mt-2 w-full resize-y px-3 py-3 text-base leading-6 outline-none" /></label><Button variant="danger" disabled={pending} onClick={() => void run(() => rejectOffer(offer.id, propertySlug, rejectionReason), "rejected")} className="mt-4 min-h-11 px-4 text-[12px]">Merkja tilboð hafnað</Button></div>}
      {status === "accepted" && <p className="kelvo-status-success mt-6 rounded-[12px] px-4 py-4 text-[12px]">Tilboðið hefur verið staðfest samþykkt og viðskiptin eru komin í samningsundirbúning.</p>}
      {status === "rejected" && <p className="kelvo-status-danger mt-6 rounded-[12px] px-4 py-4 text-[12px]">Tilboðið hefur verið skráð hafnað.</p>}
      {error && <p role="alert" className="mt-3 text-[11px] text-[#a24f48]">{error}</p>}
    </section>
  </>;
}
