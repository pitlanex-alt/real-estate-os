"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function recordSellerIntent(offerId: string, propertySlug: string, intent: "accept" | "reject" | "counter_offer") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_customer_seller_offer_intent", { p_offer_id: offerId, p_intent: intent });
  if (error) throw new Error(error.message);
  revalidatePath(`/seller/${propertySlug}/offers/${offerId}`);
}
