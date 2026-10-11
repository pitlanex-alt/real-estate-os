import { notFound } from "next/navigation";
import { AgentOfferReview } from "./components/AgentOfferReview";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { getAgentOffer } from "@/lib/offers/detail";
import { getPropertyWorkspace } from "@/lib/properties/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function AgentOfferPage({ params, searchParams }: { params: Promise<{ propertySlug: string; offerId: string }>; searchParams: Promise<{ from?: string }> }) {
  const { propertySlug, offerId } = await params;
  const { from } = await searchParams;
  const offersContext = from === "offers";
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const [offer, workspace] = await Promise.all([
    getAgentOffer(offerId),
    getPropertyWorkspace(supabase, propertySlug, identity.organizationId),
  ]);
  if (!offer || !workspace.data || !workspace.data.offers.some((item) => item.id === offerId)) notFound();
  return <><div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 xl:px-12"><AgentOfferReview offer={offer} propertySlug={propertySlug} nowIso={new Date().toISOString()} backHref={offersContext ? "/offers" : `/properties/${propertySlug}`} backLabel={offersContext ? "Tilboð" : offer.property} /></div></>;
}
