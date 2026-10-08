"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { FileUpload } from "@/app/components/ui/FileUpload";
import type { PropertyImage } from "@/lib/property-images/server";
import { createClient } from "@/lib/supabase/client";
import { deletePropertyImage, reorderPropertyImage, setPropertyCover } from "../actions";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maximumImageBytes = 15 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export function PropertyImageManager({ slug, organizationId, propertyId, images, canEdit }: { slug: string; organizationId: string; propertyId: string; images: PropertyImage[]; canEdit: boolean }) {
  const router = useRouter();
  const [cover, setCover] = useState(!images.length);
  const [uploadKey, setUploadKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<void>) { setError(null); startTransition(async () => { try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aðgerð mistókst."); } }); }

  function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Veldu mynd til að hlaða upp.");
      return;
    }
    if (!allowedImageTypes.has(file.type)) {
      setError("Veldu JPG, PNG, WebP eða AVIF mynd.");
      return;
    }
    if (file.size > maximumImageBytes) {
      setError("Myndin má að hámarki vera 15 MB.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const objectId = crypto.randomUUID();
      const fileId = crypto.randomUUID();
      const extension = imageExtensions[file.type];
      const storagePath = `organizations/${organizationId}/properties/${propertyId}/${objectId}/mynd-${fileId}.${extension}`;
      let uploaded = false;
      try {
        const { error: uploadError } = await supabase.storage.from("property-images").upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) {
          setError("Ekki tókst að hlaða myndinni upp. Reyndu aftur.");
          return;
        }
        uploaded = true;

        const { error: metadataError } = await supabase.rpc("create_property_image_record", {
          p_property_id: propertyId,
          p_storage_path: storagePath,
          p_file_name: file.name,
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
          p_is_cover: cover,
        });
        if (metadataError) {
          const { error: cleanupError } = await supabase.storage.from("property-images").remove([storagePath]);
          setError(cleanupError
            ? "Myndinni var hlaðið upp en skráning hennar mistókst og ekki tókst að hreinsa upp. Hafðu samband við umsjónaraðila."
            : "Ekki tókst að vista myndina. Upphleðslan var hreinsuð; reyndu aftur.");
          return;
        }

        uploaded = false;
        form.reset();
        setUploadKey((value) => value + 1);
        setCover(false);
        router.refresh();
      } catch {
        const cleanupFailed = uploaded
          ? Boolean((await supabase.storage.from("property-images").remove([storagePath])).error)
          : false;
        setError(cleanupFailed
          ? "Upphleðsla rofnaði og ekki tókst að hreinsa upp. Hafðu samband við umsjónaraðila."
          : "Upphleðsla rofnaði. Reyndu aftur.");
      }
    });
  }

  return <section className="kelvo-card mt-6 p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[16px] font-semibold">Myndir</h2><p className="mt-2 text-[11px] text-[#737b75]">Forsíðumynd birtist á eignayfirliti og í gáttum.</p></div>
      {canEdit && <form onSubmit={uploadImage} className="flex flex-wrap items-center gap-3"><FileUpload key={uploadKey} name="file" accept="image/jpeg,image/png,image/webp,image/avif" required disabled={pending} presentation="action" className="w-full sm:w-[280px]" /><Checkbox name="isCover" checked={cover} onChange={setCover} disabled={pending} label="Forsíða" className="text-[11px] text-[var(--text-secondary)]" /><Button type="submit" variant="primary" disabled={pending}><Upload size={14} />{pending ? "Hleð upp…" : "Hlaða upp"}</Button></form>}
    </div>
    {error && <p role="alert" className="mt-4 text-[12px] text-[#c98279]">{error}</p>}
    {images.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{images.map((image, index) => <article key={image.id} className="overflow-hidden rounded-[14px] border border-black/[0.07] bg-white shadow-[0_4px_16px_rgba(25,34,24,0.04)]"><div className="relative aspect-[4/3] bg-[var(--surface-soft)]">{image.url ? <Image unoptimized fill sizes="220px" src={image.url} alt="" className="object-cover" /> : null}{image.isCover && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-medium text-[#3f594c] shadow-sm">Forsíða</span>}</div>{canEdit && <div className="flex items-center justify-between p-1.5"><Button variant="icon" aria-label="Færa til vinstri" disabled={pending || index === 0} onClick={() => run(() => reorderPropertyImage(slug, image.id, Math.max(0, image.sortOrder - 1)))} className="size-10"><ArrowLeft size={14} /></Button><Button variant="icon" aria-label="Velja sem forsíðu" disabled={pending || image.isCover} onClick={() => run(() => setPropertyCover(slug, image.id))} className="size-10"><Star size={14} /></Button><Button variant="icon" aria-label="Færa til hægri" disabled={pending || index === images.length - 1} onClick={() => run(() => reorderPropertyImage(slug, image.id, image.sortOrder + 1))} className="size-10"><ArrowRight size={14} /></Button><Button variant="danger" aria-label="Eyða mynd" disabled={pending} onClick={() => run(() => deletePropertyImage(slug, image.id))} className="size-10 border-transparent"><Trash2 size={14} /></Button></div>}</article>)}</div> : <p className="mt-6 rounded-[12px] bg-[var(--surface-soft)] px-4 py-7 text-[12px] text-[var(--text-secondary)]">Engar myndir skráðar.</p>}
  </section>;
}
