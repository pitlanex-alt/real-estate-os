import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renditions = {
  avatar: { width: 256, height: 256, resize: "cover" as const, quality: 80 },
  editor: { width: 1024, resize: "contain" as const, quality: 84 },
} as const;

function headers(etag: string, length?: number | string | null) {
  const result = new Headers({ "Cache-Control": "private, max-age=3600, must-revalidate", "Content-Type": "image/webp", ETag: etag, Vary: "Cookie", "X-Content-Type-Options": "nosniff" });
  if (length) result.set("Content-Length", String(length));
  return result;
}

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const url = new URL(request.url);
  const rendition = url.searchParams.get("rendition") === "editor" ? "editor" : "avatar";
  const transactionId = url.searchParams.get("transactionId");
  const settings = renditions[rendition];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not found", { status: 404 });

  let profilePhotoPath: string | null = null;
  let version = "current";
  const profileResult = await supabase.from("profiles").select("id,profile_photo_path,updated_at").eq("id", userId).maybeSingle();
  if (profileResult.data?.profile_photo_path) {
    profilePhotoPath = profileResult.data.profile_photo_path;
    version = String(Date.parse(profileResult.data.updated_at));
  } else if (transactionId) {
    const agentResult = await supabase.rpc("customer_agent_profile", { p_transaction_id: transactionId });
    const agent = agentResult.data && typeof agentResult.data === "object" && !Array.isArray(agentResult.data) ? agentResult.data as Record<string, unknown> : null;
    if (!agentResult.error && agent && String(agent.id) === userId && agent.profile_photo_path) {
      profilePhotoPath = String(agent.profile_photo_path);
      if (agent.profile_updated_at) version = String(Date.parse(String(agent.profile_updated_at)));
    }
  }
  if (!profilePhotoPath) return new Response("Not found", { status: 404 });

  const etag = `"profile-${userId}-${rendition}-${version}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: headers(etag) });

  const transformed = await supabase.storage.from("agency-assets").createSignedUrl(profilePhotoPath, 120, { transform: settings });
  if (transformed.data?.signedUrl) {
    const response = await fetch(transformed.data.signedUrl, { cache: "no-store", headers: { Accept: "image/webp,image/*" } });
    if (response.ok && response.body && response.headers.get("content-type")?.startsWith("image/")) return new Response(response.body, { status: 200, headers: headers(etag, response.headers.get("content-length")) });
  }

  const original = await supabase.storage.from("agency-assets").createSignedUrl(profilePhotoPath, 120);
  if (!original.data?.signedUrl) return new Response("Not found", { status: 404 });
  const response = await fetch(original.data.signedUrl, { cache: "no-store" });
  if (!response.ok) return new Response("Image unavailable", { status: 502 });
  try {
    const output = await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize(rendition === "editor" ? { width: 1024, height: 1024, fit: "inside", withoutEnlargement: true } : { width: 256, height: 256, fit: "cover", position: "centre", withoutEnlargement: true }).webp({ quality: settings.quality, effort: 3 }).toBuffer();
    return new Response(output, { status: 200, headers: headers(etag, output.byteLength) });
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
}
