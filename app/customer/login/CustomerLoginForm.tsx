"use client";

import { useActionState } from "react";
import { customerLogin, type CustomerLoginState } from "./actions";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLogin, { error: null } satisfies CustomerLoginState);
  return <form action={action} className="mt-8 space-y-5"><div><label htmlFor="customer-email" className="text-[12px] font-medium text-[#8c948e]">Netfang</label><input id="customer-email" name="email" type="email" autoComplete="email" required className="mt-2 min-h-12 w-full rounded-[8px] border border-white/[0.08] bg-[#191d1a] px-4 text-base text-[#dedfd8] outline-none focus:border-[#6f846f]/60" /></div><div><label htmlFor="customer-password" className="text-[12px] font-medium text-[#8c948e]">Lykilorð</label><input id="customer-password" name="password" type="password" autoComplete="current-password" required className="mt-2 min-h-12 w-full rounded-[8px] border border-white/[0.08] bg-[#191d1a] px-4 text-base text-[#dedfd8] outline-none focus:border-[#6f846f]/60" /></div>{state.error && <p role="alert" className="text-[13px] text-[#c98278]">{state.error}</p>}<button type="submit" disabled={pending} className="min-h-12 w-full rounded-[8px] bg-[#6f846f] px-5 text-base font-semibold text-[#111412] disabled:opacity-60">{pending ? "Skrái inn…" : "Skrá inn"}</button></form>;
}
