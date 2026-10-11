import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthorizedDocument = {
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
};

function safeFilename(value: string | null) {
  const cleaned = (value || "skjal")
    .replace(/[\r\n]/g, " ")
    .replace(/[\\/]/g, "-")
    .replace(/"/g, "'")
    .trim();
  return cleaned || "skjal";
}

function contentDisposition(fileName: string, download: boolean) {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "_") || "skjal";
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_document_download", {
    p_document_id: documentId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return new Response("Not found", { status: 404 });
  }

  const document = data as unknown as AuthorizedDocument;
  const { data: signed, error: signedError } = await supabase.storage
    .from("transaction-documents")
    .createSignedUrl(document.storage_path, 60);
  if (signedError || !signed?.signedUrl) return new Response("Not found", { status: 404 });

  const range = request.headers.get("range");
  const upstream = await fetch(signed.signedUrl, {
    cache: "no-store",
    headers: range ? { Range: range } : undefined,
  });
  if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  let fileName = safeFilename(document.file_name);
  const isPdf = document.mime_type === "application/pdf" || fileName.toLocaleLowerCase("is-IS").endsWith(".pdf");
  if (isPdf && !fileName.toLocaleLowerCase("is-IS").endsWith(".pdf")) fileName += ".pdf";
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(fileName, download),
    "Content-Type": isPdf ? "application/pdf" : document.mime_type || upstream.headers.get("content-type") || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["accept-ranges", "content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
