import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import type { PropertyImageRendition } from "@/lib/property-images/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renditions: Record<PropertyImageRendition, {
  width: number;
  height: number;
  quality: number;
}> = {
  card: { width: 480, height: 360, quality: 72 },
  manager: { width: 640, height: 480, quality: 74 },
  gallery: { width: 720, height: 540, quality: 76 },
  hero: { width: 1280, height: 800, quality: 78 },
};

const cacheControl = "private, max-age=3600, must-revalidate";

function responseHeaders(contentType: string, etag: string, contentLength?: string | number | null) {
  const headers = new Headers({
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
    ETag: etag,
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentLength) headers.set("Content-Length", String(contentLength));
  return headers;
}

function imageResponse(body: BodyInit, contentType: string, etag: string, contentLength?: string | number | null) {
  return new Response(body, {
    status: 200,
    headers: responseHeaders(contentType, etag, contentLength),
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const requestedRendition = new URL(request.url).searchParams.get("rendition") ?? "manager";
  if (!(requestedRendition in renditions)) return new Response("Not found", { status: 404 });
  const rendition = requestedRendition as PropertyImageRendition;
  const settings = renditions[rendition];
  const supabase = await createClient();

  // This SELECT is deliberately made with the caller's authenticated client.
  // property_images RLS covers both internal memberships and active portal grants.
  const { data: image, error } = await supabase
    .from("property_images")
    .select("id,storage_path,created_at")
    .eq("id", imageId)
    .maybeSingle();
  if (error || !image) return new Response("Not found", { status: 404 });

  // Storage paths are immutable (uploads use unique paths and upsert=false), so
  // metadata-only changes such as ordering do not invalidate the image bytes.
  const etag = `"property-image-${image.id}-${rendition}-v1-${Date.parse(image.created_at)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: responseHeaders("image/webp", etag) });
  }

  // Prefer Supabase's private image render service. The short-lived signed URL
  // never reaches the browser; callers see the stable, cacheable Kelvo URL.
  const { data: transformed } = await supabase.storage.from("property-images").createSignedUrl(
    image.storage_path,
    120,
    {
      transform: {
        width: settings.width,
        height: settings.height,
        resize: "cover",
        quality: settings.quality,
      },
    },
  );
  if (transformed?.signedUrl) {
    const upstream = await fetch(transformed.signedUrl, {
      cache: "no-store",
      headers: { Accept: "image/avif,image/webp,image/*" },
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (upstream.ok && contentType.startsWith("image/") && upstream.body) {
      return imageResponse(
        upstream.body,
        contentType,
        etag,
        upstream.headers.get("content-length"),
      );
    }
  }

  // Supabase transformations are plan/configuration dependent. This fallback
  // still guarantees a display-sized WebP rather than leaking the original
  // multi-megapixel object into a thumbnail request.
  const { data: original } = await supabase.storage.from("property-images").createSignedUrl(
    image.storage_path,
    120,
  );
  if (!original?.signedUrl) return new Response("Image unavailable", { status: 502 });
  const originalResponse = await fetch(original.signedUrl, { cache: "no-store" });
  if (!originalResponse.ok) return new Response("Image unavailable", { status: 502 });

  try {
    const output = await sharp(Buffer.from(await originalResponse.arrayBuffer()))
      .rotate()
      .resize({
        width: settings.width,
        height: settings.height,
        fit: "cover",
        position: "centre",
        withoutEnlargement: true,
      })
      .webp({ quality: settings.quality, effort: 3 })
      .toBuffer();
    return imageResponse(output, "image/webp", etag, output.byteLength);
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
}
