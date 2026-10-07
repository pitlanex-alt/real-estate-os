"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type ListingPreparationState = {
  error: string | null;
  success: string | null;
  readiness: "not_started" | "in_progress" | "ready" | null;
};

export type PublishReadinessState = {
  error: string | null;
  success: string | null;
};

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `mynd-${randomUUID()}.${extension}`;
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalInteger(value: string, allowNegative = false) {
  if (!value.trim()) return null;
  const normalized = allowNegative
    ? value.replace(/[^\d-]/g, "")
    : value.replace(/\D/g, "");
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function saveListingPreparation(
  propertySlug: string,
  transactionId: string,
  _state: ListingPreparationState,
  formData: FormData,
): Promise<ListingPreparationState> {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", propertySlug)
    .eq("organization_id", identity.organizationId)
    .maybeSingle();
  if (!property) return { error: "Eign fannst ekki.", success: null, readiness: null };
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("property_id", property.id)
    .eq("organization_id", identity.organizationId)
    .maybeSingle();
  if (!transaction) return { error: "Viðskipti fundust ekki.", success: null, readiness: null };

  const floorValue = formText(formData, "floor");
  const askingPriceValue = formText(formData, "askingPrice");
  const monthlyFeesValue = formText(formData, "monthlyFees");
  const floor = optionalInteger(floorValue, true);
  const askingPrice = optionalInteger(askingPriceValue);
  const monthlyFees = optionalInteger(monthlyFeesValue);
  if ((floorValue && floor === null) || (askingPriceValue && askingPrice === null) || (monthlyFeesValue && monthlyFees === null)) {
    return { error: "Athugaðu tölugildi fyrir hæð, ásett verð og mánaðargjöld.", success: null, readiness: null };
  }
  const highlights = formText(formData, "highlights")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index);
  if (highlights.length > 20 || highlights.some((item) => item.length > 160)) {
    return { error: "Skráðu mest 20 áhersluatriði, hvert að hámarki 160 stafir.", success: null, readiness: null };
  }

  const { data, error } = await supabase.rpc("update_listing_preparation", {
    p_transaction_id: transactionId,
    p_property_type: formText(formData, "propertyType") || null,
    p_floor: floor,
    p_parking: formText(formData, "parking") || null,
    p_monthly_fees_isk: monthlyFees,
    p_listing_title: formText(formData, "listingTitle") || null,
    p_listing_description: formText(formData, "listingDescription") || null,
    p_listing_highlights: highlights,
    p_asking_price_isk: askingPrice,
    p_required_documents_ready: formData.get("requiredDocumentsReady") === "on",
  });
  if (error) {
    return {
      error: error.code === "42501"
        ? "Þú hefur ekki heimild til að breyta skráningunni."
        : "Ekki tókst að vista undirbúning skráningar.",
      success: null,
      readiness: null,
    };
  }
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/properties");
  return {
    error: null,
    success: "Undirbúningur skráningar vistaður.",
    readiness: data as ListingPreparationState["readiness"],
  };
}

export async function markListingReadyForPublish(
  propertySlug: string,
  transactionId: string,
  _state: PublishReadinessState,
  _formData: FormData,
): Promise<PublishReadinessState> {
  void _state;
  void _formData;
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id,property:properties!transactions_property_id_fkey(slug)")
    .eq("id", transactionId)
    .eq("organization_id", identity.organizationId)
    .maybeSingle();
  const relatedProperty = Array.isArray(transaction?.property)
    ? transaction.property[0]
    : transaction?.property;
  if (!transaction || relatedProperty?.slug !== propertySlug) {
    return { error: "Skráning fannst ekki.", success: null };
  }

  const { error } = await supabase.rpc("mark_listing_ready_for_publish", {
    p_transaction_id: transactionId,
  });
  if (error) {
    return {
      error: error.code === "42501"
        ? "Þú hefur ekki heimild til að staðfesta skráninguna."
        : error.code === "23514"
          ? "Ekki er búið að uppfylla öll skilyrði birtingar."
          : "Ekki tókst að merkja skráninguna tilbúna.",
      success: null,
    };
  }
  revalidatePath(`/properties/${propertySlug}`);
  return { error: null, success: "Skráningin er tilbúin til birtingar." };
}

export async function uploadPropertyImage(propertySlug: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Veldu mynd til að hlaða upp.");
  if (!allowedTypes.has(file.type) || file.size > 15 * 1024 * 1024) throw new Error("Mynd verður að vera JPG, PNG, WebP eða AVIF og mest 15 MB.");
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  const { data: property, error: propertyError } = await supabase.from("properties").select("id,organization_id").eq("slug", propertySlug).eq("organization_id", identity.organizationId).single();
  if (propertyError || !property) throw new Error("Eign fannst ekki.");
  const path = `organizations/${property.organization_id}/properties/${property.id}/${randomUUID()}/${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error("Ekki tókst að hlaða myndinni upp.");
  const { error: recordError } = await supabase.rpc("create_property_image_record", { p_property_id: property.id, p_storage_path: path, p_file_name: file.name, p_mime_type: file.type, p_file_size_bytes: file.size, p_is_cover: formData.get("isCover") === "on" });
  if (recordError) {
    await supabase.storage.from("property-images").remove([path]);
    throw new Error("Ekki tókst að vista myndina.");
  }
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/properties");
}

export async function setPropertyCover(propertySlug: string, imageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_property_image_cover", { p_image_id: imageId });
  if (error) throw new Error("Ekki tókst að velja forsíðumynd.");
  revalidatePath(`/properties/${propertySlug}`); revalidatePath("/properties");
}

export async function reorderPropertyImage(propertySlug: string, imageId: string, sortOrder: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_property_image", { p_image_id: imageId, p_sort_order: sortOrder });
  if (error) throw new Error("Ekki tókst að færa myndina.");
  revalidatePath(`/properties/${propertySlug}`);
}

export async function deletePropertyImage(propertySlug: string, imageId: string) {
  const supabase = await createClient();
  const { data: image, error: imageError } = await supabase.from("property_images").select("storage_path").eq("id", imageId).single();
  if (imageError || !image) throw new Error("Mynd fannst ekki.");
  const { error: storageError } = await supabase.storage.from("property-images").remove([image.storage_path]);
  if (storageError) throw new Error("Ekki tókst að eyða mynd úr geymslu.");
  const { error } = await supabase.rpc("delete_property_image_record", { p_image_id: imageId });
  if (error) throw new Error("Mynd var fjarlægð en ekki tókst að hreinsa skráningu hennar.");
  revalidatePath(`/properties/${propertySlug}`); revalidatePath("/properties");
}
