"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type Setup = { factorId: string; qrCode: string; secret: string };

export function MfaEnrollment({ destination }: { destination: string }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const factors = await supabase.auth.mfa.listFactors();
    if (!factors.error) {
      const staleFactors = factors.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
      await Promise.all(staleFactors.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));
    }
    const enrollment = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Kelvo" });
    if (enrollment.error) {
      setError("Ekki tókst að hefja uppsetningu. Reyndu aftur.");
      setPending(false);
      return;
    }
    setSetup({ factorId: enrollment.data.id, qrCode: enrollment.data.totp.qr_code, secret: enrollment.data.totp.secret });
    setPending(false);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup || pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: setup.factorId });
    const verification = challenge.error ? null : await supabase.auth.mfa.verify({ factorId: setup.factorId, challengeId: challenge.data.id, code: code.trim() });
    if (challenge.error || verification?.error) {
      setError("Öryggiskóðinn er rangur eða útrunninn.");
      setPending(false);
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  if (!setup) return <div className="mt-7"><Button variant="primary" onClick={begin} disabled={pending} className="min-h-12 w-full text-base font-semibold">{pending ? "Undirbý…" : "Setja upp auðkenningu"}</Button>{error && <p role="alert" className="mt-4 rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{error}</p>}</div>;

  return (
    <form onSubmit={verify} className="mt-7 space-y-5">
      <div className="mx-auto w-fit rounded-[16px] border border-black/[0.08] bg-white p-3"><Image src={setup.qrCode} alt="QR-kóði fyrir auðkenningarforrit" width={184} height={184} unoptimized /></div>
      <div><p className="text-[11px] leading-5 text-[var(--text-secondary)]">Skannaðu kóðann í auðkenningarforriti. Ef skönnun virkar ekki geturðu slegið inn lykilinn:</p><code className="mt-2 block break-all rounded-[10px] bg-[var(--surface-soft)] px-3 py-2 text-[11px] text-[var(--text-primary)]">{setup.secret}</code></div>
      <label className="block text-[12px] font-medium text-[#555d56]" htmlFor="enrollment-code">Sex stafa öryggiskóði<Input id="enrollment-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} autoFocus required className="mt-2 text-center tracking-[0.28em]" /></label>
      {error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending || code.length !== 6} className="min-h-12 w-full text-base font-semibold">{pending ? "Staðfesti…" : "Virkja auðkenningu"}</Button>
    </form>
  );
}
