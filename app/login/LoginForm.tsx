"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ resetComplete = false }: { resetComplete?: boolean }) {
  const [state, action, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="text-[12px] font-medium text-[#555d56]">Netfang</label>
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus required className="mt-2" />
      </div>
      <div>
        <div className="flex items-center justify-between gap-4"><label htmlFor="password" className="text-[12px] font-medium text-[#555d56]">Lykilorð</label><Link href="/auth/reset-password" className="mo-button-text text-[11px] font-medium">Gleymt lykilorð?</Link></div>
        <div className="relative mt-2"><Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="pr-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="mo-button mo-button-icon absolute right-1 top-1 grid size-10 place-items-center" aria-label={showPassword ? "Fela lykilorð" : "Sýna lykilorð"} title={showPassword ? "Fela lykilorð" : "Sýna lykilorð"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      </div>
      {resetComplete && <p className="rounded-[12px] bg-[var(--surface-accent)] px-3 py-2.5 text-[13px] text-[#536451]">Lykilorðið hefur verið uppfært. Þú getur nú skráð þig inn.</p>}
      {state.error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={pending} className="min-h-12 w-full text-base font-semibold">
        {pending ? "Staðfesti aðgang…" : "Skrá inn"}
      </Button>
    </form>
  );
}
