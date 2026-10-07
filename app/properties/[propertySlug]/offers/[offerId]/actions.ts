"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refreshOfferViews(propertySlug: string, offerId: string) {
  revalidatePath(`/properties/${propertySlug}/offers/${offerId}`);
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath(`/buyer/${propertySlug}`);
  revalidatePath(`/buyer/${propertySlug}/offers/${offerId}`);
  revalidatePath(`/seller/${propertySlug}`);
  revalidatePath(`/seller/${propertySlug}/offers/${offerId}`);
}

export async function requestOfferChange(offerId: string, propertySlug: string, reason: string) {
  if (!reason.trim()) throw new Error("Ástæða er nauðsynleg.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_offer_change", { p_offer_id: offerId, p_reason: reason.trim() });
  if (error) throw new Error(error.message);
  refreshOfferViews(propertySlug, offerId);
}

export async function approveOfferForSeller(offerId: string, propertySlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_offer_for_seller", { p_offer_id: offerId });
  if (error) throw new Error(error.message);
  refreshOfferViews(propertySlug, offerId);
}

export async function sendOfferToSeller(offerId: string, propertySlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_offer_to_seller", { p_offer_id: offerId });
  if (error) throw new Error(error.message);
  refreshOfferViews(propertySlug, offerId);
}

export async function confirmOfferAccepted(offerId: string, propertySlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_offer_outcome", {
    p_offer_id: offerId,
    p_outcome: "accepted",
    p_reason: "Seller acceptance intent confirmed by responsible agent",
  });
  if (error) {
    throw new Error(error.code === "42501"
      ? "Þú hefur ekki heimild til að staðfesta tilboðið."
      : error.code === "23514"
        ? "Tilboðið er ekki tilbúið til staðfestingar."
        : "Ekki tókst að staðfesta samþykkt tilboðs.");
  }
  refreshOfferViews(propertySlug, offerId);
}

export async function rejectOffer(offerId: string, propertySlug: string, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_offer_outcome", {
    p_offer_id: offerId,
    p_outcome: "rejected",
    p_reason: reason?.trim() || null,
  });
  if (error) {
    throw new Error(error.code === "42501"
      ? "Þú hefur ekki heimild til að hafna tilboðinu."
      : error.code === "23514"
        ? "Ekki er hægt að hafna tilboðinu í núverandi stöðu."
        : "Ekki tókst að skrá höfnun tilboðs.");
  }
  refreshOfferViews(propertySlug, offerId);
}
