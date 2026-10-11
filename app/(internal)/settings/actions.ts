"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireInternalIdentity } from "@/lib/auth/post-auth";

export type SettingsState = { error: string | null; success: string | null; savedAt?: number };

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
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("profile_photo_path,profile_photo_source_path")
    .eq("id", identity.userId)
    .maybeSingle();
  const profilePhotoPath = text(formData, "profilePhotoPath") || null;
  const profilePhotoSourcePath = text(formData, "profilePhotoSourcePath") || null;
  const expectedPrefix = `organizations/${identity.organizationId}/profiles/${identity.userId}/`;
  if (profilePhotoPath && (!profilePhotoPath.startsWith(expectedPrefix) || !profilePhotoPath.endsWith("/avatar.webp"))) {
    return { error: "Ógild slóð fyrir prófílmynd.", success: null };
  }
  if (profilePhotoSourcePath) {
    if (!profilePhotoPath || !profilePhotoSourcePath.startsWith(expectedPrefix)) {
      return { error: "Ógild slóð fyrir upprunamynd.", success: null };
    }
  }
  const cropX = profilePhotoPath ? Number(text(formData, "profilePhotoCropX")) : null;
  const cropY = profilePhotoPath ? Number(text(formData, "profilePhotoCropY")) : null;
  const cropZoom = profilePhotoPath ? Number(text(formData, "profilePhotoCropZoom")) : null;
  if (profilePhotoPath && (
    !Number.isFinite(cropX) || !Number.isFinite(cropY) || !Number.isFinite(cropZoom)
    || cropX! < -1 || cropX! > 1 || cropY! < -1 || cropY! > 1 || cropZoom! < 1 || cropZoom! > 3
  )) {
    return { error: "Ógild staðsetning prófílmyndar.", success: null };
  }
  const profile = await supabase.rpc("update_own_profile_with_photo", {
    p_display_name: text(formData, "displayName"),
    p_professional_title: text(formData, "professionalTitle") || null,
    p_phone: text(formData, "profilePhone") || null,
    p_email: text(formData, "profileEmail") || null,
    p_profile_photo_path: profilePhotoPath,
    p_profile_photo_source_path: profilePhotoSourcePath,
    p_profile_photo_crop_x: cropX,
    p_profile_photo_crop_y: cropY,
    p_profile_photo_crop_zoom: cropZoom,
  });
  if (profile.error) {
    const stagedPaths = [
      profilePhotoPath,
      profilePhotoSourcePath !== existingProfile?.profile_photo_source_path ? profilePhotoSourcePath : null,
    ].filter((path): path is string => Boolean(path));
    if (stagedPaths.length) await supabase.storage.from("agency-assets").remove(stagedPaths);
    return { error: "Ekki tókst að vista prófílinn.", success: null };
  }
  if (profilePhotoPath && existingProfile?.profile_photo_path && existingProfile.profile_photo_path !== profilePhotoPath) {
    const removal = await supabase.storage.from("agency-assets").remove([existingProfile.profile_photo_path]);
    if (removal.error) console.error("Unable to remove previous profile photo", removal.error);
  }
  if (profilePhotoSourcePath && existingProfile?.profile_photo_source_path && existingProfile.profile_photo_source_path !== profilePhotoSourcePath) {
    const removal = await supabase.storage.from("agency-assets").remove([existingProfile.profile_photo_source_path]);
    if (removal.error) console.error("Unable to remove previous profile photo source", removal.error);
  }
  revalidatePath("/settings"); revalidatePath("/", "layout");
  return { error: null, success: "Prófíll vistaður.", savedAt: Date.now() };
}
