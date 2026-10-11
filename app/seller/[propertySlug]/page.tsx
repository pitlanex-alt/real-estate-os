import { CustomerPropertyOverview } from "@/app/components/CustomerPropertyOverview";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { getCustomerAgentProfile, getCustomerCoverImage, getCustomerTransactionOffers, getSellerListingReview } from "@/lib/portal/customer";
import { getSellerPortalContext } from "@/lib/portal/context";
import { getCustomerWorkItems } from "@/lib/work-items/server";
import { SellerListingReview } from "./components/SellerListingReview";

export default async function SellerPortalPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params;
  const context = await getSellerPortalContext(propertySlug);
  if (!context) return <PortalAccessDenied />;
  const transactionId = context.destination.transactionId;
  const [workItems, offers, coverImageUrl, agent, listingReview] = await Promise.all([getCustomerWorkItems(transactionId), getCustomerTransactionOffers(transactionId, context.supabase), getCustomerCoverImage(transactionId, context.supabase), getCustomerAgentProfile(transactionId, context.supabase), getSellerListingReview(transactionId, context.supabase)]);
  const summary = { ...context.summary, coverImageUrl, agent: agent ?? context.summary.agent };
  if (listingReview.denied) return <PortalAccessDenied />;
  return <CustomerPropertyOverview audience="seller" slug={propertySlug} summary={summary} tasks={workItems.tasks} documents={workItems.documents} offers={offers.data} listingReview={listingReview.data ? <SellerListingReview propertySlug={propertySlug} listing={listingReview.data} /> : null} />;
}
