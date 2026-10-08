"use client";

import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { customerLogin, type CustomerLoginState } from "./actions";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLogin, { error: null } satisfies CustomerLoginState);
  return <form action={action} className="mt-8 space-y-5"><div><label htmlFor="customer-email" className="text-[12px] font-medium text-[#555d56]">Netfang</label><Input id="customer-email" name="email" type="email" autoComplete="email" required className="mt-2" /></div><div><label htmlFor="customer-password" className="text-[12px] font-medium text-[#555d56]">Lykilorð</label><Input id="customer-password" name="password" type="password" autoComplete="current-password" required className="mt-2" /></div>{state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}<Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full text-base font-semibold">{pending ? "Skrái inn…" : "Skrá inn"}</Button></form>;
}
