import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PropertyImage = {
  id: string;
  propertyId: string;
  storagePath: string;
  fileName: string;
  sortOrder: number;
  isCover: boolean;
  url: string | null;
};

export async function getPropertyImages(client: Client, propertyIds: string[]) {
  if (!propertyIds.length) return new Map<string, PropertyImage[]>();
  const { data, error } = await client.from("property_images")
    .select("id,property_id,storage_path,file_name,sort_order,is_cover")
    .in("property_id", propertyIds)
    .order("sort_order").order("created_at");
  if (error) {
    console.error("Unable to load property images", error);
    return new Map<string, PropertyImage[]>();
  }
  const rows = data ?? [];
  const paths = rows.map((row) => row.storage_path);
  const signed = paths.length
    ? await client.storage.from("property-images").createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signed.error) console.error("Unable to sign property images", signed.error);
  const urlByPath = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
  const result = new Map<string, PropertyImage[]>();
  for (const row of rows) {
    const values = result.get(row.property_id) ?? [];
    values.push({ id: row.id, propertyId: row.property_id, storagePath: row.storage_path, fileName: row.file_name, sortOrder: row.sort_order, isCover: row.is_cover, url: urlByPath.get(row.storage_path) ?? null });
    result.set(row.property_id, values);
  }
  return result;
}
