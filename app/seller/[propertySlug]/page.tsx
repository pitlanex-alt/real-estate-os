import { notFound, redirect } from "next/navigation";
import { CustomerPropertyOverview } from "@/app/components/CustomerPropertyOverview";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { customerInitials, getCustomerAgentProfile, getCustomerCoverImage, getCustomerDestinationBySlug, getCustomerTransactionOffers, getSellerListingReview, getSellerTransactionSummary } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";
import { getCustomerWorkItems } from "@/lib/work-items/server";
import { SellerListingReview } from "./components/SellerListingReview";

export default async function SellerPortalPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/customer/login?next=/seller/${propertySlug}`);
  const destination = await getCustomerDestinationBySlug(propertySlug, "seller", supabase);
  if (destination.denied || !destination.data) return <PortalAccessDenied />;
  const summary = await getSellerTransactionSummary(destination.data.transactionId); if (!summary.data) { if (summary.denied) return <PortalAccessDenied />; notFound(); }
  const [workItems, offers, coverImageUrl, agent, listingReview] = await Promise.all([getCustomerWorkItems(destination.data.transactionId), getCustomerTransactionOffers(destination.data.transactionId, supabase), getCustomerCoverImage(destination.data.transactionId, supabase), getCustomerAgentProfile(destination.data.transactionId, supabase), getSellerListingReview(destination.data.transactionId, supabase)]); summary.data.coverImageUrl=coverImageUrl;if(agent)summary.data.agent=agent;
  if (listingReview.denied) return <PortalAccessDenied />;
  return <CustomerShell customerName={summary.data.customer.name} customerInitials={customerInitials(summary.data.customer.name)} customerRole="Seljandi" homeHref={`/seller/${propertySlug}`} portalLabel="Seljandagátt"><CustomerPropertyOverview audience="seller" slug={propertySlug} summary={summary.data} tasks={workItems.tasks} documents={workItems.documents} offers={offers.data} listingReview={listingReview.data ? <SellerListingReview propertySlug={propertySlug} listing={listingReview.data} /> : null} /></CustomerShell>;
}
