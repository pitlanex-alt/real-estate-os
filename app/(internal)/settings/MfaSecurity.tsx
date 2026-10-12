"use client";

import { ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MfaEnrollment } from "@/app/auth/mfa/MfaEnrollment";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Panel } from "@/app/components/ui/Panel";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; name: string; createdAt: string };

export function MfaSecurity({ factors }: { factors: Factor[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!removing || pending || factors.length <= 1) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: removing });
    const verification = challenge.error ? null : await supabase.auth.mfa.verify({ factorId: removing, challengeId: challenge.data.id, code: code.trim() });
    if (challenge.error || verification?.error) {
      setError("Öryggiskóðinn er rangur eða útrunninn.");
      setPending(false);
      return;
    }
    const result = await supabase.auth.mfa.unenroll({ factorId: removing });
    if (result.error) {
      setError("Ekki tókst að fjarlægja auðkenninguna.");
      setPending(false);
      return;
    }
    setRemoving(null);
    setCode("");
    setPending(false);
    router.refresh();
  }

  return (
    <Panel>
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--surface-accent)] text-[#536451]"><ShieldCheck size={19} /></span><div><h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Öryggi og tveggja þátta auðkenning</h2><p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">Auðkenningarforrit er áskilið fyrir allt starfsfólk áður en vinnusvæðið opnast.</p></div></div>
      <div className="mt-5 divide-y divide-black/[0.06] border-y border-black/[0.06]">
        {factors.map((factor) => <div key={factor.id} className="flex min-h-16 items-center justify-between gap-4 py-3"><div><p className="text-[12px] font-semibold text-[var(--text-primary)]">{factor.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">Virkt auðkenningarforrit</p></div><Button variant="danger" size="icon" disabled={factors.length <= 1 || pending} onClick={() => { setRemoving(factor.id); setCode(""); setError(null); }} aria-label={`Fjarlægja ${factor.name}`} title={factors.length <= 1 ? "Bættu við annarri auðkenningu áður en þessi er fjarlægð" : "Fjarlægja auðkenningu"}><Trash2 size={15} /></Button></div>)}
      </div>
      {removing && <form onSubmit={removeFactor} className="mt-5 rounded-[14px] border border-[#b75e56]/15 bg-[#fdf7f6] p-4"><p className="text-[12px] font-semibold text-[var(--text-primary)]">Staðfestu áður en auðkenning er fjarlægð</p><p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Sláðu inn núverandi sex stafa kóða. Síðasta auðkenningin má ekki vera fjarlægð.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} autoFocus required className="max-w-52 text-center tracking-[0.24em]" /><Button type="submit" variant="danger" disabled={pending || code.length !== 6}>{pending ? "Fjarlægi…" : "Staðfesta og fjarlægja"}</Button><Button variant="secondary" disabled={pending} onClick={() => setRemoving(null)}>Hætta við</Button></div>{error && <p role="alert" className="mt-3 text-[12px] text-[#914b45]">{error}</p>}</form>}
      <div className="mt-6 border-t border-black/[0.06] pt-6"><h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Bæta við auðkenningarforriti</h3><p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Settu fyrst upp nýja auðkenningu ef þú þarft að skipta um síma eða forrit.</p><div className="max-w-sm"><MfaEnrollment destination="/settings" /></div></div>
    </Panel>
  );
}
