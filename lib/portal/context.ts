import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getBuyerPropertySummary,
  getCustomerDestinationBySlug,
  getSellerTransactionSummary,
} from "@/lib/portal/customer";
import { createClient } from "@/lib/supabase/server";

export const getBuyerPortalContext = cache(async (propertySlug: string) => {
  const supabase = await createClient();
  const destination = await getCustomerDestinationBySlug(propertySlug, "buyer", supabase);
  if (destination.unauthenticated) redirect(`/customer/login?next=/buyer/${propertySlug}`);
  if (!destination.data) return null;

  const summary = await getBuyerPropertySummary(destination.data.transactionId, supabase);
  if (!summary.data) return null;

  return { supabase, destination: destination.data, summary: summary.data };
});

export const getSellerPortalContext = cache(async (propertySlug: string) => {
  const supabase = await createClient();
  const destination = await getCustomerDestinationBySlug(propertySlug, "seller", supabase);
  if (destination.unauthenticated) redirect(`/customer/login?next=/seller/${propertySlug}`);
  if (!destination.data) return null;

  const summary = await getSellerTransactionSummary(destination.data.transactionId, supabase);
  if (!summary.data) return null;

  return { supabase, destination: destination.data, summary: summary.data };
});
