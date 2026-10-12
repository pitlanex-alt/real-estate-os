"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { updatePassword, type PasswordUpdateState } from "./actions";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, { error: null } satisfies PasswordUpdateState);
  const [visible, setVisible] = useState(false);
  return <form action={action} className="mt-7 space-y-5"><label htmlFor="new-password" className="block text-[12px] font-medium text-[#555d56]">Nýtt lykilorð<div className="relative mt-2"><Input id="new-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} autoFocus required className="pr-12" /><button type="button" onClick={() => setVisible((value) => !value)} className="mo-button mo-button-icon absolute right-1 top-1 grid size-10 place-items-center" aria-label={visible ? "Fela lykilorð" : "Sýna lykilorð"}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><span className="mt-2 block text-[11px] text-[var(--text-muted)]">Að minnsta kosti 10 stafir.</span></label><label htmlFor="password-confirmation" className="block text-[12px] font-medium text-[#555d56]">Staðfesta lykilorð<Input id="password-confirmation" name="passwordConfirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} required className="mt-2" /></label>{state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}<Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full text-base font-semibold">{pending ? "Vista…" : "Vista nýtt lykilorð"}</Button></form>;
}
