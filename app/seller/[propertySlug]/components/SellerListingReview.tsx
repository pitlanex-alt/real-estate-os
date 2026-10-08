"use client";

import { Check, Circle } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { formatIcelandicDate, formatIcelandicTime } from "@/lib/datetime/iceland";
import { formatIsk } from "@/lib/offers/model";
import type { SellerListingReview as SellerListingReviewData } from "@/lib/portal/customer";
import { submitSellerListingResponse, type SellerListingResponseState } from "../actions";

const propertyTypeLabels: Record<string, string> = {
  apartment: "Íbúð",
  house: "Einbýlishús",
  townhouse: "Rað- eða parhús",
  summerhouse: "Sumarhús",
  commercial: "Atvinnuhúsnæði",
  land: "Lóð",
  other: "Annað",
};

function displayValue(value: string | number | null, suffix = "") {
  return value === null || value === "" ? "—" : `${value}${suffix}`;
}

export function SellerListingReview({ propertySlug, listing }: { propertySlug: string; listing: SellerListingReviewData }) {
  const action = submitSellerListingResponse.bind(null, propertySlug, listing.transactionId);
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    success: null,
  } satisfies SellerListingResponseState);
  const images = [...listing.images].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder);
  const cover = images[0];
  const canRespond = Boolean(listing.title?.trim() && listing.description?.trim());
  const facts = [
    ["Tegund", listing.property.propertyType ? propertyTypeLabels[listing.property.propertyType] ?? listing.property.propertyType : "—"],
    ["Stærð", displayValue(listing.property.sizeSqm, " m²")],
    ["Herbergi", displayValue(listing.property.roomCount)],
    ["Svefnherbergi", displayValue(listing.property.bedroomCount)],
    ["Byggingarár", displayValue(listing.property.yearBuilt)],
    ["Hæð", displayValue(listing.property.floor)],
    ["Bílastæði", displayValue(listing.property.parking)],
    ["Mánaðargjöld", listing.property.monthlyFeesIsk === null ? "—" : formatIsk(listing.property.monthlyFeesIsk)],
  ];
  const checks = [
    ["Upplýsingar um eign", listing.checklist.propertyFactsComplete],
    ["Myndir", listing.checklist.photosUploaded],
    ["Lýsing", listing.checklist.descriptionComplete],
    ["Nauðsynleg gögn", listing.checklist.requiredDocumentsReady],
  ] as const;

  return <section className="kelvo-card mt-6 p-5 sm:p-7">
    <div className="max-w-3xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#819181]">Yfirferð skráningar</p>
      <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Skráning eignarinnar</h2>
      <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">Farðu yfir framsetningu eignarinnar og sendu fasteignasalanum samþykki eða ósk um breytingu.</p>
    </div>

    {cover?.url && <div className="relative mt-8 aspect-[16/7] min-h-[220px] overflow-hidden rounded-[18px] border border-black/[0.07]">
      <Image unoptimized fill sizes="(max-width: 1180px) 100vw, 1120px" src={cover.url} alt={listing.title ?? listing.property.address} className="object-cover" />
    </div>}
    {images.length > 1 && <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
      {images.slice(1, 5).map((image) => <div key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-[12px] border border-black/[0.07] bg-[var(--surface-soft)]">
        {image.url ? <Image unoptimized fill sizes="240px" src={image.url} alt={image.fileName} className="object-cover" /> : <span className="flex h-full items-center justify-center text-[11px] text-[var(--text-secondary)]">Mynd ekki tiltæk</span>}
      </div>)}
    </div>}

    <div className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#687069]">Fyrirsögn</p>
        <h3 className="mt-3 text-[24px] font-semibold leading-tight text-[var(--text-primary)]">{listing.title || "Fyrirsögn er ekki tilbúin"}</h3>
        <p className="mt-3 text-[14px] font-semibold text-[#526545]">{listing.askingPriceIsk === null ? "Verð ekki skráð" : formatIsk(listing.askingPriceIsk)}</p>
        <div className="mt-8 whitespace-pre-wrap text-[14px] leading-7 text-[#4f5650]">{listing.description || "Lýsing er ekki tilbúin."}</div>
        {listing.highlights.length > 0 && <div className="mt-9 border-t border-black/[0.06] pt-6"><h4 className="text-[14px] font-semibold">Helstu atriði</h4><ul className="mt-4 grid gap-3 sm:grid-cols-2">{listing.highlights.map((highlight) => <li key={highlight} className="flex gap-3 text-[13px] leading-5 text-[#4f5650]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#69805f]" />{highlight}</li>)}</ul></div>}
      </div>

      <aside>
        <h3 className="text-[15px] font-semibold">Upplýsingar um eign</h3>
        <dl className="mt-4 border-t border-black/[0.06]">{facts.map(([label, value]) => <div key={label} className="flex min-h-11 items-center justify-between gap-5 border-b border-black/[0.06] py-2"><dt className="text-[11px] text-[var(--text-secondary)]">{label}</dt><dd className="text-right text-[12px] font-medium text-[#343934]">{value}</dd></div>)}</dl>
        <h3 className="mt-8 text-[15px] font-semibold">Yfirlit</h3>
        <div className="mt-4 border-t border-black/[0.06]">{checks.map(([label, complete]) => <div key={label} className="flex min-h-11 items-center gap-3 border-b border-black/[0.06]"><span className={complete ? "text-[#69805f]" : "text-[#b4bab3]"}>{complete ? <Check size={15} /> : <Circle size={13} />}</span><span className={complete ? "text-[11px] text-[#4f5d4e]" : "text-[11px] text-[var(--text-secondary)]"}>{label}</span></div>)}</div>
      </aside>
    </div>

    <form action={formAction} className="mt-10 rounded-[16px] bg-[var(--surface-soft)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div><h3 className="text-[17px] font-semibold">Svar þitt</h3>{listing.latestResponse && <p className="mt-2 text-[11px] text-[#737b75]">Síðast sent {formatIcelandicDate(listing.latestResponse.submittedAt)} kl. {formatIcelandicTime(listing.latestResponse.submittedAt)}</p>}</div>
        <span className={listing.latestResponse?.type === "approved" ? "text-[11px] text-[#9caf9a]" : listing.latestResponse?.type === "changes_requested" ? "text-[11px] text-[#c99a52]" : "text-[11px] text-[#858d87]"}>{listing.latestResponse?.type === "approved" ? "Samþykkt" : listing.latestResponse?.type === "changes_requested" ? "Óskað eftir breytingu" : "Bíður svars"}</span>
      </div>
      {listing.latestResponse?.feedback && <p className="mt-4 max-w-3xl whitespace-pre-wrap border-l-2 border-[#b98a3f] pl-4 text-[13px] leading-6 text-[#4f5650]">{listing.latestResponse.feedback}</p>}
      <label className="mt-6 block max-w-3xl text-[12px] text-[#8b938d]">Athugasemd ef óskað er breytinga<textarea name="feedback" maxLength={4000} rows={4} className="mo-control mt-2 w-full resize-y px-3 py-3 text-base leading-6 outline-none" placeholder="Lýstu því sem þú vilt að fasteignasalinn breyti…" /></label>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" name="responseType" value="approved" variant="primary" disabled={pending || !canRespond} className="min-h-11 px-5 text-base font-semibold">Samþykkja skráningu</Button>
        <Button type="submit" name="responseType" value="changes_requested" variant="secondary" disabled={pending || !canRespond} className="min-h-11 px-5 text-base font-semibold">Óska eftir breytingu</Button>
      </div>
      {!canRespond && <p className="mt-4 text-[12px] text-[#c99a52]">Skráningin er enn í undirbúningi og ekki tilbúin til svars.</p>}
      {state.error && <p role="alert" className="mt-4 text-[12px] text-[#c98279]">{state.error}</p>}
      {state.success && <p className="mt-4 text-[12px] text-[#9caf9a]">{state.success}</p>}
    </form>
  </section>;
}
