"use client";

import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { DatePicker } from "@/app/components/ui/DatePicker";
import { DateTimePicker } from "@/app/components/ui/DateTimePicker";
import { Input } from "@/app/components/ui/Input";
import { createBuyerOffer, type OfferFormState } from "./actions";

export function OfferForm({ transactionId, propertySlug, askingPrice }: { transactionId: string; propertySlug: string; askingPrice: number }) {
  const [state, action, pending] = useActionState(createBuyerOffer, { error: null } satisfies OfferFormState);
  const [validUntil, setValidUntil] = useState("");
  const [handover, setHandover] = useState("");
  const [financing, setFinancing] = useState(false);
  return <form action={action} className="kelvo-card mt-6 space-y-6 p-5 sm:p-7">
    <input type="hidden" name="transactionId" value={transactionId} />
    <input type="hidden" name="propertySlug" value={propertySlug} />
    <div>
      <label className="text-[12px] font-medium text-[#555d56]" htmlFor="amount">Tilboðsupphæð</label>
      <Input id="amount" name="amount" required defaultValue={Math.round(askingPrice * .97)} inputMode="numeric" className="mt-2" />
      <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Ásett verð: {askingPrice.toLocaleString("is-IS")} kr.</p>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label className="text-[12px] font-medium text-[#555d56]">Gildir til</label><DateTimePicker name="validUntil" value={validUntil} onChange={setValidUntil} required className="mt-2" ariaLabel="Gildir til" /></div>
      <div><label className="text-[12px] font-medium text-[#555d56]">Óskuð afhending</label><DatePicker name="handover" value={handover} onChange={setHandover} required className="mt-2" ariaLabel="Óskuð afhending" /></div>
    </div>
    <Checkbox name="financing" checked={financing} onChange={setFinancing} label="Tilboð háð fjármögnun" className="min-h-12 rounded-[12px] border border-black/[0.07] bg-[var(--surface-soft)] px-3 py-3 text-[14px]" />
    <p className="rounded-[12px] bg-[var(--surface-accent)] px-4 py-3 text-[12px] leading-5 text-[#596856]">Tilboðið verður sent til fasteignasala til yfirferðar áður en það fer áfram í ferlið.</p>
    {state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}
    <Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full px-5 text-base font-semibold">{pending ? "Sendi…" : "Staðfesta og senda tilboð"}</Button>
  </form>;
}
