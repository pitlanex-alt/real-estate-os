import { CustomerPropertyOverview } from "@/app/components/CustomerPropertyOverview";
import { getCustomerAgentProfile, getCustomerCoverImage, getCustomerTransactionOffers } from "@/lib/portal/customer";
import { getBuyerPortalContext } from "@/lib/portal/context";
import { getCustomerWorkItems } from "@/lib/work-items/server";

export default async function BuyerPortalPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params;
  const context = await getBuyerPortalContext(propertySlug);
  if (!context) return null;
  const transactionId = context.destination.transactionId;
  const [workItems, offers, coverImageUrl, agent] = await Promise.all([
    getCustomerWorkItems(transactionId),
    getCustomerTransactionOffers(transactionId, context.supabase),
    getCustomerCoverImage(transactionId, context.supabase),
    getCustomerAgentProfile(transactionId, context.supabase),
  ]);
  const summary = { ...context.summary, coverImageUrl, agent: agent ?? context.summary.agent };
  return <CustomerPropertyOverview audience="buyer" slug={propertySlug} summary={summary} tasks={workItems.tasks} documents={workItems.documents} offers={offers.data} />;
}
