import { notFound, redirect } from "next/navigation";
import { CustomerPropertyOverview } from "@/app/components/CustomerPropertyOverview";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { customerInitials, getBuyerPropertySummary, getCustomerDestinationBySlug, getCustomerTransactionOffers } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";
import { getCustomerWorkItems } from "@/lib/work-items/server";

export default async function BuyerPortalPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/customer/login?next=/buyer/${propertySlug}`);
  const destination = await getCustomerDestinationBySlug(propertySlug, "buyer", supabase);
  if (destination.denied || !destination.data) return <PortalAccessDenied />;
  const summary = await getBuyerPropertySummary(destination.data.transactionId); if (!summary.data) { if (summary.denied) return <PortalAccessDenied />; notFound(); }
  const [workItems, offers] = await Promise.all([getCustomerWorkItems(destination.data.transactionId), getCustomerTransactionOffers(destination.data.transactionId, supabase)]);
  return <CustomerShell customerName={summary.data.customer.name} customerInitials={customerInitials(summary.data.customer.name)} customerRole="Kaupandi" homeHref={`/buyer/${propertySlug}`} portalLabel="Kaupendagátt"><CustomerPropertyOverview audience="buyer" slug={propertySlug} summary={summary.data} tasks={workItems.tasks} documents={workItems.documents} offers={offers.data} /></CustomerShell>;
}
