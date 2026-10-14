"use server";

import { revalidatePath } from "next/cache";
import { isOfferExpiryError } from "@/lib/offers/model";
import { createClient } from "@/lib/supabase/server";

export async function recordSellerIntent(offerId: string, propertySlug: string, intent: "accept" | "reject" | "counter_offer") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_customer_seller_offer_intent", { p_offer_id: offerId, p_intent: intent });
  if (error) {
    throw new Error(isOfferExpiryError(error)
      ? "Tilboðið er útrunnið og ekki er lengur hægt að svara því."
      : "Ekki tókst að senda svarið. Reyndu aftur.");
  }
  revalidatePath(`/seller/${propertySlug}/offers/${offerId}`);
}
