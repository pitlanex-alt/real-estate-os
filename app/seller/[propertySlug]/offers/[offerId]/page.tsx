import { notFound, redirect } from "next/navigation";
import { CustomerShell } from "@/app/components/CustomerShell";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { SellerOfferView } from "./components/SellerOfferView";
import { getSellerOffer } from "@/lib/offers/detail";
import { customerInitials, getCustomerDestinationBySlug, getCustomerTransactionOffers, getSellerTransactionSummary, propertyRouteSlug } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";

export default async function SellerOfferPage({params}:{params:Promise<{propertySlug:string;offerId:string}>}){const{propertySlug,offerId}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect(`/customer/login?next=/seller/${propertySlug}/offers/${offerId}`);const destination=await getCustomerDestinationBySlug(propertySlug,"seller",supabase);if(!destination.data)return <PortalAccessDenied/>;const[summary,offer,availableOffers]=await Promise.all([getSellerTransactionSummary(destination.data.transactionId),getSellerOffer(offerId),getCustomerTransactionOffers(destination.data.transactionId,supabase)]);if(offer.denied||summary.denied)return <PortalAccessDenied/>;if(!offer.data||!summary.data||availableOffers.error||!availableOffers.data.some(item=>item.id===offerId)||propertyRouteSlug(offer.data.property)!==propertySlug)notFound();return <CustomerShell customerName={summary.data.customer.name} customerInitials={customerInitials(summary.data.customer.name)} customerRole="Seljandi" homeHref={`/seller/${propertySlug}`} portalLabel="Seljandagátt"><SellerOfferView offer={offer.data} propertySlug={propertySlug}/></CustomerShell>}
