"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function MfaChallengeForm({ factorId, destination }: { factorId: string; destination: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const lastAutomaticAttemptRef = useRef("");

  const verifyCode = useCallback(async (value: string) => {
    const normalizedCode = value.trim();
    if (normalizedCode.length !== 6 || submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError("Ekki tókst að staðfesta kóðann. Athugaðu kóðann og reyndu aftur.");
      submittingRef.current = false;
      setPending(false);
      return;
    }
    const verification = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: normalizedCode });
    if (verification.error) {
      setError("Ekki tókst að staðfesta kóðann. Athugaðu kóðann og reyndu aftur.");
      submittingRef.current = false;
      setPending(false);
      return;
    }
    router.replace(destination);
    router.refresh();
  }, [destination, factorId, router]);

  useEffect(() => {
    if (code.length !== 6 || lastAutomaticAttemptRef.current === code) return;
    lastAutomaticAttemptRef.current = code;
    void verifyCode(code);
  }, [code, verifyCode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verifyCode(code);
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block text-[12px] font-medium text-[#555d56]" htmlFor="mfa-code">
        Sex stafa öryggiskóði
        <Input id="mfa-code" value={code} onChange={(event) => { const nextCode = event.target.value.replace(/\D/g, "").slice(0, 6); if (nextCode !== code) { lastAutomaticAttemptRef.current = ""; setError(null); } setCode(nextCode); }} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} autoFocus required className="mt-2 text-center tracking-[0.28em]" />
      </label>
      {error && <p role="alert" className="rounded-[12px] bg-[#f7e7e5] px-3 py-2.5 text-[13px] text-[#914b45]">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending || code.length !== 6} className="min-h-12 w-full text-base font-semibold">{pending ? "Staðfesti…" : "Staðfesta"}</Button>
    </form>
  );
}
