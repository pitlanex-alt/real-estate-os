"use client";

import { useActionState } from "react";
import { customerLogin, type CustomerLoginState } from "./actions";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLogin, { error: null } satisfies CustomerLoginState);
  return <form action={action} className="mt-8 space-y-5"><div><label htmlFor="customer-email" className="text-[12px] font-medium text-[#8c948e]">Netfang</label><input id="customer-email" name="email" type="email" autoComplete="email" required className="mo-control mt-2 min-h-12 w-full px-4 text-base outline-none" /></div><div><label htmlFor="customer-password" className="text-[12px] font-medium text-[#8c948e]">Lykilorð</label><input id="customer-password" name="password" type="password" autoComplete="current-password" required className="mo-control mt-2 min-h-12 w-full px-4 text-base outline-none" /></div>{state.error && <p role="alert" className="text-[13px] text-[#c98278]">{state.error}</p>}<button type="submit" disabled={pending} className="mo-button mo-button-primary min-h-12 w-full px-5 text-base font-semibold">{pending ? "Skrái inn…" : "Skrá inn"}</button></form>;
}
