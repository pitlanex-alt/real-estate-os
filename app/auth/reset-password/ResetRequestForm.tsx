"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { requestPasswordReset, type ResetRequestState } from "./actions";

const initialState: ResetRequestState = { sent: false, error: null };

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  if (state.sent) return <div className="mt-7"><p className="rounded-[14px] bg-[var(--surface-accent)] px-4 py-4 text-[13px] leading-6 text-[#536451]">Ef aðgangur er skráður á netfangið færðu tölvupóst með næstu skrefum.</p><Link href="/login" className="mo-button mo-button-secondary mt-5 min-h-11 w-full px-4 text-[12px]">Til baka í innskráningu</Link></div>;
  return <form action={action} className="mt-7 space-y-5"><label htmlFor="reset-email" className="block text-[12px] font-medium text-[#555d56]">Netfang<Input id="reset-email" name="email" type="email" autoComplete="email" autoFocus required className="mt-2" /></label>{state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}<Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full text-base font-semibold">{pending ? "Sendi…" : "Senda endurstillingartengil"}</Button><Link href="/login" className="mo-button mo-button-text min-h-11 w-full text-[12px]">Til baka</Link></form>;
}
