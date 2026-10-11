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
  thumbnailUrl: string | null;
};

export async function getPropertyImages(client: Client, propertyIds: string[], options: { coverOnly?: boolean; thumbnailWidth?: number; thumbnailHeight?: number } = {}) {
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
  const paths = rows.map((row) => row.storage_path);
  const signed = paths.length
    ? await client.storage.from("property-images").createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signed.error) console.error("Unable to sign property images", signed.error);
  const urlByPath = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
  const thumbnailResults = await Promise.all(rows.map(async (row) => ({
    path: row.storage_path,
    result: await client.storage.from("property-images").createSignedUrl(row.storage_path, 3600, {
      transform: {
        width: options.thumbnailWidth ?? 560,
        height: options.thumbnailHeight ?? 420,
        resize: "cover",
        quality: 76,
      },
    }),
  })));
  const thumbnailByPath = new Map(thumbnailResults.map(({ path, result }) => [
    path,
    result.data?.signedUrl ?? urlByPath.get(path) ?? null,
  ]));
  const result = new Map<string, PropertyImage[]>();
  for (const row of rows) {
    const values = result.get(row.property_id) ?? [];
    values.push({ id: row.id, propertyId: row.property_id, storagePath: row.storage_path, fileName: row.file_name, sortOrder: row.sort_order, isCover: row.is_cover, url: urlByPath.get(row.storage_path) ?? null, thumbnailUrl: thumbnailByPath.get(row.storage_path) ?? null });
    result.set(row.property_id, values);
  }
  return result;
}
