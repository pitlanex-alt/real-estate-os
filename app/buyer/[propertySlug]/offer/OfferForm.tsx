"use client";

import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { DatePicker } from "@/app/components/ui/DatePicker";
import { DateTimePicker } from "@/app/components/ui/DateTimePicker";
import { createBuyerOffer, type OfferFormState } from "./actions";

export function OfferForm({ transactionId, propertySlug, askingPrice }: { transactionId: string; propertySlug: string; askingPrice: number }) {
  const [state, action, pending] = useActionState(createBuyerOffer, { error: null } satisfies OfferFormState);
  const [validUntil, setValidUntil] = useState("");
  const [handover, setHandover] = useState("");
  const [financing, setFinancing] = useState(false);
  return <form action={action} className="mt-8 space-y-6">
    <input type="hidden" name="transactionId" value={transactionId} />
    <input type="hidden" name="propertySlug" value={propertySlug} />
    <div>
      <label className="text-[12px] text-[#929a94]" htmlFor="amount">Tilboðsupphæð</label>
      <input id="amount" name="amount" required defaultValue={Math.round(askingPrice * .97)} inputMode="numeric" className="mo-control mt-2 min-h-12 w-full px-4 text-base outline-none" />
      <p className="mt-2 text-[11px] text-[#69716b]">Ásett verð: {askingPrice.toLocaleString("is-IS")} kr.</p>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label className="text-[12px] text-[#929a94]">Gildir til</label><DateTimePicker name="validUntil" value={validUntil} onChange={setValidUntil} required className="mt-2" ariaLabel="Gildir til" /></div>
      <div><label className="text-[12px] text-[#929a94]">Óskuð afhending</label><DatePicker name="handover" value={handover} onChange={setHandover} required className="mt-2" ariaLabel="Óskuð afhending" /></div>
    </div>
    <Checkbox name="financing" checked={financing} onChange={setFinancing} label="Tilboð háð fjármögnun" className="min-h-12 border-y border-white/[0.07] py-3 text-[14px]" />
    <p className="text-[12px] leading-5 text-[#737b75]">Tilboðið verður sent til fasteignasala til yfirferðar áður en það fer áfram í ferlið.</p>
    {state.error && <p role="alert" className="text-[13px] text-[#c98279]">{state.error}</p>}
    <Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full px-5 text-base font-semibold">{pending ? "Sendi…" : "Staðfesta og senda tilboð"}</Button>
  </form>;
}
