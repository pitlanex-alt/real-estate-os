"use client";

import { Check, Circle } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { Select } from "@/app/components/ui/Select";
import type { PropertyWorkspaceData } from "@/lib/properties/workspace";
import {
  markListingReadyForPublish,
  saveListingPreparation,
  type ListingPreparationState,
  type PublishReadinessState,
} from "../actions";

const propertyTypes = [
  { value: "apartment", label: "Íbúð" },
  { value: "house", label: "Einbýlishús" },
  { value: "townhouse", label: "Rað- eða parhús" },
  { value: "summerhouse", label: "Sumarhús" },
  { value: "commercial", label: "Atvinnuhúsnæði" },
  { value: "land", label: "Lóð" },
  { value: "other", label: "Annað" },
];

function Field({ label, name, defaultValue, inputMode }: { label: string; name: string; defaultValue: string; inputMode?: "numeric" }) {
  return <label className="block text-[11px] text-[#8b938d]">{label}<input name={name} defaultValue={defaultValue} inputMode={inputMode} className="mo-control mt-2 min-h-11 w-full px-3 text-base outline-none" /></label>;
}

export function ListingPreparation({ property, canEdit }: { property: PropertyWorkspaceData; canEdit: boolean }) {
  const listing = property.listing;
  const [propertyType, setPropertyType] = useState(listing.propertyType ?? "");
  const [title, setTitle] = useState(listing.title ?? "");
  const [description, setDescription] = useState(listing.description ?? "");
  const [highlights, setHighlights] = useState(listing.highlights.join("\n"));
  const [documentsReady, setDocumentsReady] = useState(listing.requiredDocumentsReady);
  const action = saveListingPreparation.bind(null, property.slug, property.transactionId);
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    success: null,
    readiness: listing.readiness,
  } satisfies ListingPreparationState);
  const publishAction = markListingReadyForPublish.bind(null, property.slug, property.transactionId);
  const [publishState, publishFormAction, publishPending] = useActionState(publishAction, {
    error: null,
    success: null,
  } satisfies PublishReadinessState);

  const factsComplete = Boolean(propertyType && property.sizeSqm !== null && property.roomCount !== null && property.yearBuilt !== null);
  const descriptionComplete = Boolean(title.trim() && description.trim());
  const checks = [
    { label: "Upplýsingar um eign fullnægjandi", complete: factsComplete },
    { label: "Myndir komnar inn", complete: listing.photosUploaded },
    { label: "Lýsing fullunnin", complete: descriptionComplete },
    { label: "Samþykki seljanda", complete: listing.sellerResponse?.type === "approved" && listing.sellerResponse.isCurrent },
    { label: "Nauðsynleg skjöl tilbúin", complete: documentsReady },
  ];
  const completed = checks.filter((item) => item.complete).length;
  const readiness = completed === checks.length ? "ready" : completed > 0 ? "in_progress" : "not_started";
  const readinessLabel = readiness === "ready" ? "Tilbúin til skráningar" : readiness === "in_progress" ? "Í vinnslu" : "Ekki hafið";
  const publishingLabel = listing.publishing.state === "ready_to_publish"
    ? "Tilbúið til birtingar"
    : listing.publishing.state === "needs_attention"
      ? "Þarf yfirferð"
      : "Ekki tilbúið";
  const missingRequirements = listing.publishing.requirements.filter((requirement) => !requirement.complete);
  const canMarkReady = missingRequirements.length === 0 && listing.publishing.state !== "ready_to_publish";

  return <section className="py-8">
    <div className="grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:gap-16">
      <form action={formAction}>
        <fieldset disabled={!canEdit || pending} className="space-y-8">
          <div><p className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#758675]">Undirbúningur skráningar</p><h2 className="mt-2 text-[18px] font-semibold">Upplýsingar og framsetning</h2><p className="mt-2 max-w-xl text-[11px] leading-5 text-[#737b75]">Gögnin eru aðeins vistuð í Mó. Ekkert er birt á ytri fasteignavefjum.</p></div>

          <div className="grid gap-5 border-t border-white/[0.07] pt-6 sm:grid-cols-2">
            <label className="block text-[11px] text-[#8b938d]">Tegund eignar<Select name="propertyType" ariaLabel="Tegund eignar" value={propertyType} onChange={setPropertyType} options={propertyTypes} placeholder="Veldu tegund" className="mt-2" /></label>
            <Field label="Hæð" name="floor" defaultValue={listing.floor === null ? "" : String(listing.floor)} inputMode="numeric" />
            <Field label="Bílastæði" name="parking" defaultValue={listing.parking ?? ""} />
            <Field label="Mánaðargjöld" name="monthlyFees" defaultValue={listing.monthlyFeesIsk === null ? "" : String(listing.monthlyFeesIsk)} inputMode="numeric" />
            <div className="sm:col-span-2"><Field label="Ásett verð" name="askingPrice" defaultValue={property.askingPriceIsk === null ? "" : String(property.askingPriceIsk)} inputMode="numeric" /></div>
          </div>

          <div className="space-y-5 border-t border-white/[0.07] pt-6">
            <label className="block text-[11px] text-[#8b938d]">Fyrirsögn<input name="listingTitle" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="mo-control mt-2 min-h-11 w-full px-3 text-base outline-none" /></label>
            <label className="block text-[11px] text-[#8b938d]">Lýsing<textarea name="listingDescription" value={description} onChange={(event) => setDescription(event.target.value)} rows={8} className="mo-control mt-2 w-full resize-y px-3 py-3 text-base leading-6 outline-none" /></label>
            <label className="block text-[11px] text-[#8b938d]">Áhersluatriði<span className="ml-2 text-[#616963]">Eitt atriði í hverri línu</span><textarea name="highlights" value={highlights} onChange={(event) => setHighlights(event.target.value)} rows={5} className="mo-control mt-2 w-full resize-y px-3 py-3 text-base leading-6 outline-none" /></label>
          </div>

          <div className="border-t border-white/[0.07] pt-6">
            <Checkbox name="requiredDocumentsReady" checked={documentsReady} onChange={setDocumentsReady} label="Nauðsynleg skjöl eru tilbúin" className="text-[12px] text-[#aeb4ae]" />
          </div>

          {canEdit && <Button type="submit" variant="primary" disabled={pending} className="min-h-11 px-5 text-[13px] font-semibold">{pending ? "Vista…" : "Vista undirbúning"}</Button>}
        </fieldset>
        {!canEdit && <p className="mt-5 text-[12px] text-[#737b75]">Þú hefur lesaðgang að undirbúningi skráningar.</p>}
        {state.error && <p role="alert" className="mt-4 text-[12px] text-[#c98279]">{state.error}</p>}
        {state.success && <p className="mt-4 text-[12px] text-[#9caf9a]">{state.success}</p>}
      </form>

      <aside>
        <div className="border-y border-white/[0.08] py-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[0.13em] text-[#758675]">Staða birtingar</p><h2 className={listing.publishing.state === "ready_to_publish" ? "mt-2 text-[17px] font-semibold text-[#9caf9a]" : listing.publishing.state === "needs_attention" ? "mt-2 text-[17px] font-semibold text-[#c99a52]" : "mt-2 text-[17px] font-semibold text-[#a1a7a1]"}>{publishingLabel}</h2></div>
            <span className={listing.publishing.state === "ready_to_publish" ? "mt-1 h-2 w-2 rounded-full bg-[#8fa18d]" : listing.publishing.state === "needs_attention" ? "mt-1 h-2 w-2 rounded-full bg-[#b68a4b]" : "mt-1 h-2 w-2 rounded-full bg-[#555d57]"} />
          </div>
          {missingRequirements.length > 0 ? <div className="mt-5"><p className="text-[10px] text-[#687069]">Vantar áður en hægt er að staðfesta:</p><ul className="mt-3 space-y-2">{missingRequirements.map((requirement) => <li key={requirement.key} className="flex items-center gap-2 text-[11px] text-[#8f9690]"><Circle size={11} className="text-[#5b625d]" />{requirement.label}</li>)}</ul></div> : <p className="mt-4 text-[11px] leading-5 text-[#899289]">Öll skilyrði eru uppfyllt. Staðfestu innri yfirferð áður en skráning fer í birtingarferli.</p>}
          {canEdit && <form action={publishFormAction} className="mt-5"><Button type="submit" variant="primary" disabled={!canMarkReady || publishPending} className="min-h-11 w-full px-4 text-[12px] font-semibold">{publishPending ? "Staðfesti…" : listing.publishing.state === "ready_to_publish" ? "Tilbúið til birtingar" : "Merkja tilbúið til birtingar"}</Button></form>}
          {publishState.error && <p role="alert" className="mt-3 text-[11px] text-[#c98279]">{publishState.error}</p>}
          {publishState.success && <p className="mt-3 text-[11px] text-[#9caf9a]">{publishState.success}</p>}
          <p className="mt-4 text-[10px] leading-4 text-[#626a64]">Þessi staðfesting birtir eignina ekki á ytri vefjum.</p>
        </div>

        <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4"><h2 className="text-[16px] font-semibold">Tilbúið til skráningar</h2><span className={readiness === "ready" ? "text-[10px] text-[#9caf9a]" : "text-[10px] text-[#bd985f]"}>{readinessLabel}</span></div>
        <div className="mt-5 border-y border-white/[0.07] py-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#687069]">Svar seljanda</p>
          <p className={listing.sellerResponse?.type === "approved" && listing.sellerResponse.isCurrent ? "mt-2 text-[12px] text-[#9caf9a]" : listing.sellerResponse?.type === "changes_requested" && listing.sellerResponse.isCurrent ? "mt-2 text-[12px] text-[#c99a52]" : "mt-2 text-[12px] text-[#858d87]"}>
            {!listing.sellerResponse ? "Bíður yfirferðar seljanda" : !listing.sellerResponse.isCurrent ? "Bíður nýrrar yfirferðar seljanda" : listing.sellerResponse.type === "approved" ? "Samþykkt" : "Óskað eftir breytingu"}
          </p>
          {listing.sellerResponse?.type === "changes_requested" && listing.sellerResponse.feedback && <p className="mt-3 whitespace-pre-wrap text-[12px] leading-5 text-[#b9bdb6]">{listing.sellerResponse.feedback}</p>}
        </div>
        <div className="mt-5 border-t border-white/[0.07]">{checks.map((item) => <div key={item.label} className="flex min-h-12 items-center gap-3 border-b border-white/[0.07]"><span className={item.complete ? "text-[#9caf9a]" : "text-[#535b55]"}>{item.complete ? <Check size={15} /> : <Circle size={13} />}</span><span className={item.complete ? "text-[11px] text-[#b9bdb6]" : "text-[11px] text-[#747c76]"}>{item.label}</span></div>)}</div>
        <p className="mt-4 text-[10px] text-[#687069]">{completed} af {checks.length} atriðum lokið</p>
        </div>
      </aside>
    </div>
  </section>;
}
