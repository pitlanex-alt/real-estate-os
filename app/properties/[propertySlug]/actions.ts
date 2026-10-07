"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireInternalIdentity } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `mynd-${randomUUID()}.${extension}`;
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
