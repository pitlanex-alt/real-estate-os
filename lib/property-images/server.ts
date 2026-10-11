import { createClient } from "@/lib/supabase/server";
import { propertyImageUrl, type PropertyImageRendition } from "./urls";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PropertyImage = {
  id: string;
  propertyId: string;
  storagePath: string;
  fileName: string;
  sortOrder: number;
  isCover: boolean;
  url: string | null;
  thumbnailUrl: string | null;
};

export async function getPropertyImages(client: Client, propertyIds: string[], options: { coverOnly?: boolean; rendition?: PropertyImageRendition } = {}) {
  if (!propertyIds.length) return new Map<string, PropertyImage[]>();
  let query = client.from("property_images")
    .select("id,property_id,storage_path,file_name,sort_order,is_cover")
    .in("property_id", propertyIds)
    .order("sort_order").order("created_at");
  if (options.coverOnly) query = query.eq("is_cover", true);
  const { data, error } = await query;
  if (error) {
    console.error("Unable to load property images", error);
    return new Map<string, PropertyImage[]>();
  }
  const rows = data ?? [];
  const rendition = options.rendition ?? "manager";
  const result = new Map<string, PropertyImage[]>();
  for (const row of rows) {
    const values = result.get(row.property_id) ?? [];
    values.push({
      id: row.id,
      propertyId: row.property_id,
      storagePath: row.storage_path,
      fileName: row.file_name,
      sortOrder: row.sort_order,
      isCover: row.is_cover,
      url: propertyImageUrl(row.id, "hero"),
      thumbnailUrl: propertyImageUrl(row.id, rendition),
    });
    result.set(row.property_id, values);
  }
  return result;
}
