"use server";

import { revalidatePath } from "next/cache";
import { getCustomerDestinationBySlug } from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";

export type SellerListingResponseState = {
  error: string | null;
  success: string | null;
};

export async function submitSellerListingResponse(
  propertySlug: string,
  transactionId: string,
  _state: SellerListingResponseState,
  formData: FormData,
): Promise<SellerListingResponseState> {
  const responseType = formData.get("responseType");
  if (responseType !== "approved" && responseType !== "changes_requested") {
    return { error: "Veldu svar áður en þú heldur áfram.", success: null };
  }
  const feedbackValue = formData.get("feedback");
  const feedback = typeof feedbackValue === "string" ? feedbackValue.trim() : "";
  if (feedback.length > 4000) {
    return { error: "Athugasemd má vera að hámarki 4.000 stafir.", success: null };
  }

  const supabase = await createClient();
  const destination = await getCustomerDestinationBySlug(propertySlug, "seller", supabase);
  if (!destination.data || destination.data.transactionId !== transactionId) {
    return { error: "Þú hefur ekki aðgang að þessari skráningu.", success: null };
  }

  const { error } = await supabase.rpc("record_seller_listing_response", {
    p_transaction_id: transactionId,
    p_response_type: responseType,
    p_feedback: responseType === "changes_requested" ? feedback || null : null,
  });
  if (error) {
    return {
      error: error.code === "42501"
        ? "Þú hefur ekki aðgang að þessari skráningu."
        : "Ekki tókst að senda svarið. Reyndu aftur.",
      success: null,
    };
  }

  revalidatePath(`/seller/${propertySlug}`);
  revalidatePath(`/properties/${propertySlug}`);
  return {
    error: null,
    success: responseType === "approved"
      ? "Samþykki þitt hefur verið sent fasteignasalanum."
      : "Breytingabeiðnin hefur verið send fasteignasalanum.",
  };
}
