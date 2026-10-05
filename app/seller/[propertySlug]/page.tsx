import { notFound, redirect } from "next/navigation";
import { CustomerPropertyOverview } from "@/app/components/CustomerPropertyOverview";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { customerInitials, getCustomerDestinationBySlug, getCustomerTransactionOffers, getSellerTransactionSummary } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";
import { getCustomerWorkItems } from "@/lib/work-items/server";

export default async function SellerPortalPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/customer/login?next=/seller/${propertySlug}`);
  const destination = await getCustomerDestinationBySlug(propertySlug, "seller", supabase);
  if (destination.denied || !destination.data) return <PortalAccessDenied />;
  const summary = await getSellerTransactionSummary(destination.data.transactionId); if (!summary.data) { if (summary.denied) return <PortalAccessDenied />; notFound(); }
  const [workItems, offers] = await Promise.all([getCustomerWorkItems(destination.data.transactionId), getCustomerTransactionOffers(destination.data.transactionId, supabase)]);
  return <CustomerShell customerName={summary.data.customer.name} customerInitials={customerInitials(summary.data.customer.name)} customerRole="Seljandi" homeHref={`/seller/${propertySlug}`} portalLabel="Seljandagátt"><CustomerPropertyOverview audience="seller" slug={propertySlug} summary={summary.data} tasks={workItems.tasks} documents={workItems.documents} offers={offers.data} /></CustomerShell>;
}
