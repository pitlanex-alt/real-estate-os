import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { AgentOfferReview } from "./components/AgentOfferReview";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getAgentOffer } from "@/lib/offers/detail";
import { getPropertyWorkspace } from "@/lib/properties/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function AgentOfferPage({ params }: { params: Promise<{ propertySlug: string; offerId: string }> }) {
  const { propertySlug, offerId } = await params;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const [offer, workspace] = await Promise.all([
    getAgentOffer(offerId),
    getPropertyWorkspace(supabase, propertySlug, identity.organizationId),
  ]);
  if (!offer || !workspace.data || !workspace.data.offers.some((item) => item.id === offerId)) notFound();
  return <AppShell activeItem="Tilboð" identity={identity}><div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 xl:px-12"><AgentOfferReview offer={offer} propertySlug={propertySlug} /></div></AppShell>;
}
