"use client";

import { useActionState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { setInvitePassword, type InvitePasswordState } from "./actions";

const initialState: InvitePasswordState = { error: null };

export function InvitePasswordForm() {
  const [state, action, pending] = useActionState(setInvitePassword, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div>
        <label htmlFor="password" className="text-[12px] font-medium text-[#555d56]">Nýtt lykilorð</label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-2" />
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Að minnsta kosti 10 stafir.</p>
      </div>
      <div>
        <label htmlFor="passwordConfirmation" className="text-[12px] font-medium text-[#555d56]">Staðfesta lykilorð</label>
        <Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={10} required className="mt-2" />
      </div>
      {state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full text-base font-semibold">
        {pending ? "Vista lykilorð…" : "Staðfesta boð"}
      </Button>
    </form>
  );
}
