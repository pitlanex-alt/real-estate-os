import { redirect } from "next/navigation";
import { MfaCard } from "@/app/auth/mfa/MfaCard";
import { MfaChallengeForm } from "@/app/auth/mfa/MfaChallengeForm";
import { getInternalMfaContext, safeInternalDestination } from "@/lib/auth/internal-mfa";

export default async function MfaChallengePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const destination = safeInternalDestination(params.next);
  const context = await getInternalMfaContext();
  if (context.aal.currentLevel === "aal2") redirect(destination);
  const factor = context.factors.totp.find((item) => item.status === "verified");
  if (!factor) redirect(`/auth/mfa/enroll?next=${encodeURIComponent(destination)}`);

  return <MfaCard eyebrow="Örugg innskráning" title="Staðfestu auðkenningu" description="Sláðu inn kóðann úr auðkenningarforritinu þínu til að opna vinnusvæðið."><MfaChallengeForm factorId={factor.id} destination={destination} /></MfaCard>;
}
