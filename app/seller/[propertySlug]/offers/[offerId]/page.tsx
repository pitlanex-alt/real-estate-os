import { notFound } from "next/navigation";
import { PortalAccessDenied } from "@/app/components/PortalAccessDenied";
import { SellerOfferView } from "./components/SellerOfferView";
import { getSellerOffer } from "@/lib/offers/detail";
import { getCustomerTransactionOffers } from "@/lib/portal/customer";
import { getSellerPortalContext } from "@/lib/portal/context";

export default async function SellerOfferPage({params}:{params:Promise<{propertySlug:string;offerId:string}>}){const{propertySlug,offerId}=await params;const context=await getSellerPortalContext(propertySlug);if(!context)return <PortalAccessDenied/>;const[offer,availableOffers]=await Promise.all([getSellerOffer(offerId,context.supabase),getCustomerTransactionOffers(context.destination.transactionId,context.supabase)]);if(offer.denied)return <PortalAccessDenied/>;if(!offer.data||availableOffers.error||!availableOffers.data.some(item=>item.id===offerId))notFound();return <SellerOfferView offer={offer.data} propertySlug={propertySlug} nowIso={new Date().toISOString()} readOnly={["completed","cancelled"].includes(context.destination.stage)}/>}
