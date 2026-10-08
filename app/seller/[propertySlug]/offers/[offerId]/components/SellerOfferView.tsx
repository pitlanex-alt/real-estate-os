"use client";

import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { formatIcelandicDate, formatIcelandicTime } from "@/lib/datetime/iceland";
import { customerOfferStatusLabel, formatIsk, offerConditionLabel, type SellerOfferData } from "@/lib/offers/model";
import { recordSellerIntent } from "../actions";

type Intent = "accept" | "reject" | "counter_offer";

export function SellerOfferView({ offer, propertySlug }: { offer: SellerOfferData; propertySlug: string }) {
  const [intent, setIntent] = useState<Intent | null>(offer.latestIntent);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const difference = offer.amountIsk - offer.askingPriceIsk;
  const finalOutcome = offer.status === "accepted" || offer.status === "rejected";

  async function select(next: Intent) { setPending(true); setError(null); try { await recordSellerIntent(offer.id, propertySlug, next); setIntent(next); } catch (caught) { setError(caught instanceof Error ? caught.message : "Ekki tókst að senda valið."); } finally { setPending(false); } }

  return <div className="mx-auto max-w-[920px] px-4 pb-8 pt-8 sm:px-6 lg:px-8">
    <Link href={`/seller/${propertySlug}`} className="mo-button mo-button-text min-h-11 gap-1.5 text-[12px]"><ChevronLeft size={14}/>{offer.property}</Link>
    <section className="kelvo-card mt-4 overflow-hidden">
      <header className="bg-[var(--surface-accent)] p-6 sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667d5d]">Tilboð</p><h1 className="mt-3 text-[36px] font-bold tracking-[-0.045em] text-[var(--text-primary)] sm:text-[42px]">{formatIsk(offer.amountIsk)}</h1><p className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${offer.status === "accepted" ? "kelvo-status-success" : offer.status === "rejected" ? "kelvo-status-danger" : "kelvo-status-progress"}`}>{finalOutcome ? customerOfferStatusLabel(offer.status) : `${offer.property} · ${offer.location}`}</p></header>
      <div className="p-5 sm:p-8"><dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-black/[0.06] bg-black/[0.06] sm:grid-cols-4">{[["Mismunur",`${difference<0?"−":"+"}${formatIsk(Math.abs(difference))}`],["Gildir til",`${formatIcelandicDate(offer.validUntil)} · ${formatIcelandicTime(offer.validUntil)}`],["Afhending",formatIcelandicDate(`${offer.requestedHandoverDate}T12:00:00Z`)],["Skilyrði",offer.conditions.map(c=>offerConditionLabel(c.type)).join(", ")||"Engin"]].map(([label,value])=><div key={label} className="bg-white p-4"><dt className="text-[11px] text-[var(--text-muted)]">{label}</dt><dd className="mt-2 text-[13px] font-medium text-[#343934]">{value}</dd></div>)}</dl>
        <section className="py-8"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Fasteignasali</p><h2 className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{offer.agent}</h2><p className="mt-6 rounded-[14px] bg-[var(--surface-soft)] px-5 py-4 text-[14px] leading-7 text-[#4f5650]">{offer.status === "accepted" ? "Tilboðið hefur verið staðfest samþykkt og viðskiptin eru komin í undirbúning samnings. Fasteignasalinn heldur utan um næstu skref." : "Ræddu við fasteignasalann áður en ákvörðun er staðfest. Val hér er aðeins viljayfirlýsing og ekki lögbindandi samþykki."}</p></section>
        {finalOutcome ? <section className={offer.status === "accepted" ? "kelvo-status-success rounded-[14px] px-4 py-5" : "kelvo-status-danger rounded-[14px] px-4 py-5"}><Check size={15} className="mr-2 inline"/>{customerOfferStatusLabel(offer.status)}. Enginn kaupsamningur hefur verið undirritaður í Kelvo.</section> : intent ? <section className="kelvo-status-success rounded-[14px] px-4 py-5"><Check size={15} className="mr-2 inline"/>Val þitt hefur verið sent til {offer.agent}.</section> : <section className="border-t border-black/[0.06] pt-7"><h2 className="text-[17px] font-semibold text-[var(--text-primary)]">Hvernig viltu halda áfram?</h2><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button variant="primary" disabled={pending} onClick={()=>void select("accept")} className="min-h-12 px-5 text-base font-semibold">Ég vil samþykkja</Button><Button variant="secondary" disabled={pending} onClick={()=>void select("counter_offer")} className="min-h-12 px-5 text-base">Ég vil ræða móttilboð</Button><Button variant="danger" disabled={pending} onClick={()=>void select("reject")} className="min-h-12 px-4 text-base">Ég vil hafna</Button></div>{error&&<p className="mt-3 rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[#914b45]">{error}</p>}</section>}
      </div>
    </section>
  </div>;
}
