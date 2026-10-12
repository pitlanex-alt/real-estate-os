import { redirect } from "next/navigation";
import { MfaCard } from "@/app/auth/mfa/MfaCard";
import { MfaEnrollment } from "@/app/auth/mfa/MfaEnrollment";
import { getInternalMfaContext, safeInternalDestination } from "@/lib/auth/internal-mfa";

export default async function MfaEnrollPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const destination = safeInternalDestination(params.next);
  const context = await getInternalMfaContext();
  if (context.aal.currentLevel === "aal2") redirect(destination);
  if (context.factors.totp.some((factor) => factor.status === "verified")) redirect(`/auth/mfa/challenge?next=${encodeURIComponent(destination)}`);

  return <MfaCard eyebrow="Öryggi reiknings" title="Settu upp tveggja þátta auðkenningu" description="Kelvo krefst auðkenningarforrits fyrir aðgang starfsfólks. Skannaðu QR-kóðann og staðfestu síðan sex stafa kóða."><MfaEnrollment destination={destination} /></MfaCard>;
}
