"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export type SettingsState = { error: string | null; success: string | null };

function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" ? value.trim() : ""; }

export async function saveSettings(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient(); const identity = await requireInternalIdentity(supabase);
  if (identity.role !== "admin") return { error: "Aðeins stjórnandi getur breytt stillingum.", success: null };
  let logoPath: string | null = null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size) {
    if (!["image/jpeg","image/png","image/webp","image/svg+xml"].includes(logo.type) || logo.size > 5*1024*1024) return { error: "Merki verður að vera mynd og mest 5 MB.", success: null };
    const extension = logo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "png";
    logoPath = `organizations/${identity.organizationId}/logo/${randomUUID()}/logo.${extension}`;
    const upload = await supabase.storage.from("agency-assets").upload(logoPath, logo, { contentType: logo.type });
    if (upload.error) return { error: "Ekki tókst að hlaða merkinu upp.", success: null };
  }
  const { error } = await supabase.rpc("update_organization_settings", { p_organization_id: identity.organizationId, p_name: text(formData,"name"), p_public_email: text(formData,"publicEmail") || null, p_phone: text(formData,"phone") || null, p_website: text(formData,"website") || null, p_address: text(formData,"address") || null, p_default_contact_name: text(formData,"defaultContactName") || null, p_default_contact_email: text(formData,"defaultContactEmail") || null, p_default_contact_phone: text(formData,"defaultContactPhone") || null, p_logo_storage_path: logoPath });
  if (error) { if (logoPath) await supabase.storage.from("agency-assets").remove([logoPath]); return { error: "Ekki tókst að vista stillingar.", success: null }; }
  revalidatePath("/settings"); revalidatePath("/", "layout");
  return { error: null, success: "Stillingar vistaðar." };
}

export async function saveProfile(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const identity = await requireInternalIdentity(supabase);
  let profilePhotoPath: string | null = null;
  const photo = formData.get("profilePhoto");
  if (photo instanceof File && photo.size) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      return { error: "Prófílmynd verður að vera JPG, PNG eða WebP og mest 5 MB.", success: null };
    }
    const extension = photo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
    profilePhotoPath = `organizations/${identity.organizationId}/profiles/${identity.userId}/${randomUUID()}/profile.${extension}`;
    const upload = await supabase.storage.from("agency-assets").upload(profilePhotoPath, photo, { contentType: photo.type });
    if (upload.error) return { error: "Ekki tókst að hlaða prófílmyndinni upp.", success: null };
  }
  const profile = await supabase.rpc("update_own_profile", {
    p_display_name: text(formData, "displayName"),
    p_professional_title: text(formData, "professionalTitle") || null,
    p_phone: text(formData, "profilePhone") || null,
    p_email: text(formData, "profileEmail") || null,
    p_profile_photo_path: profilePhotoPath,
  });
  if (profile.error) {
    if (profilePhotoPath) await supabase.storage.from("agency-assets").remove([profilePhotoPath]);
    return { error: "Ekki tókst að vista prófílinn.", success: null };
  }
  revalidatePath("/settings"); revalidatePath("/", "layout");
  return { error: null, success: "Prófíll vistaður." };
}
