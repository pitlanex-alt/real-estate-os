"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refreshOfferViews(propertySlug: string, offerId: string) {
  revalidatePath(`/properties/${propertySlug}/offers/${offerId}`);
  revalidatePath(`/buyer/${propertySlug}`);
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
