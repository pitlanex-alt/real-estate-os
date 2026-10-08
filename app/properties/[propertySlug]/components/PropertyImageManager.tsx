"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { FileUpload } from "@/app/components/ui/FileUpload";
import type { PropertyImage } from "@/lib/property-images/server";
import { createClient } from "@/lib/supabase/client";
import { deletePropertyImage } from "../actions";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maximumImageBytes = 15 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

function validateImage(file: File) {
  if (!allowedImageTypes.has(file.type)) return `${file.name}: aðeins JPG, PNG, WebP og AVIF eru leyfð.`;
  if (file.size > maximumImageBytes) return `${file.name}: myndin er stærri en 15 MB.`;
  if (file.size === 0) return `${file.name}: skráin er tóm.`;
  return null;
}

export function PropertyImageManager({ slug, organizationId, propertyId, images, canEdit }: { slug: string; organizationId: string; propertyId: string; images: PropertyImage[]; canEdit: boolean }) {
  const router = useRouter();
  const [imageItems, setImageItems] = useState(images);
  const [cover, setCover] = useState(!images.length);
  const [uploadKey, setUploadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [imageMutationPending, setImageMutationPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = new FormData(form).getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) {
      setError("Veldu eina eða fleiri myndir til að hlaða upp.");
      return;
    }

    const failures: string[] = [];
    const validFiles = files.filter((file) => {
      const validationError = validateImage(file);
      if (validationError) failures.push(validationError);
      return !validationError;
    });
    setError(null);
    setResult(null);
    setUploading(true);

    const supabase = createClient();
    let successfulUploads = 0;
    let makeNextSuccessfulUploadCover = cover;

    for (const file of validFiles) {
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
          failures.push(`${file.name}: ekki tókst að hlaða myndinni upp.`);
          continue;
        }
        uploaded = true;

        const { error: metadataError } = await supabase.rpc("create_property_image_record", {
          p_property_id: propertyId,
          p_storage_path: storagePath,
          p_file_name: file.name,
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
          p_is_cover: makeNextSuccessfulUploadCover,
        });
        if (metadataError) {
          const { error: cleanupError } = await supabase.storage.from("property-images").remove([storagePath]);
          failures.push(cleanupError
            ? `${file.name}: skráning mistókst og ekki tókst að hreinsa upp upphleðsluna.`
            : `${file.name}: ekki tókst að vista myndina; upphleðslan var hreinsuð.`);
          continue;
        }

        uploaded = false;
        successfulUploads += 1;
        makeNextSuccessfulUploadCover = false;
      } catch {
        const cleanupFailed = uploaded
          ? Boolean((await supabase.storage.from("property-images").remove([storagePath])).error)
          : false;
        failures.push(cleanupFailed
          ? `${file.name}: upphleðsla rofnaði og ekki tókst að hreinsa upp.`
          : `${file.name}: upphleðsla rofnaði.`);
      }
    }

    setUploading(false);
    if (successfulUploads) {
      form.reset();
      setUploadKey((value) => value + 1);
      setCover(false);
      setResult(`${successfulUploads} ${successfulUploads === 1 ? "mynd var vistuð" : "myndir voru vistaðar"}.`);
      router.refresh();
    }
    if (failures.length) setError(`Sumar myndir voru ekki vistaðar. ${failures.join(" ")}`);
  }

  async function moveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (imageMutationPending || targetIndex < 0 || targetIndex >= imageItems.length) return;
    const previous = imageItems;
    const moving = previous[index];
    const neighbor = previous[targetIndex];
    const next = [...previous];
    next[index] = { ...neighbor, sortOrder: moving.sortOrder };
    next[targetIndex] = { ...moving, sortOrder: neighbor.sortOrder };
    setImageItems(next);
    setError(null);
    setResult(null);
    setImageMutationPending(true);
    const { error: reorderError } = await createClient().rpc("reorder_property_image", {
      p_image_id: moving.id,
      p_sort_order: neighbor.sortOrder,
    });
    setImageMutationPending(false);
    if (reorderError) {
      setImageItems(previous);
      setError("Ekki tókst að færa myndina. Fyrri röð hefur verið endurheimt.");
    }
  }

  async function chooseCover(imageId: string) {
    if (imageMutationPending) return;
    const previous = imageItems;
    setImageItems((current) => current.map((image) => ({ ...image, isCover: image.id === imageId })));
    setError(null);
    setResult(null);
    setImageMutationPending(true);
    const { error: coverError } = await createClient().rpc("set_property_image_cover", { p_image_id: imageId });
    setImageMutationPending(false);
    if (coverError) {
      setImageItems(previous);
      setError("Ekki tókst að velja forsíðumynd. Fyrra val hefur verið endurheimt.");
    }
  }

  async function removeImage(imageId: string) {
    setError(null);
    setResult(null);
    setDeletingId(imageId);
    try {
      await deletePropertyImage(slug, imageId);
      setImageItems((current) => current.filter((image) => image.id !== imageId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ekki tókst að eyða myndinni.");
    } finally {
      setDeletingId(null);
    }
  }

  const controlsDisabled = uploading || imageMutationPending || deletingId !== null;

  return <section className="kelvo-card mt-6 p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[16px] font-semibold">Myndir</h2><p className="mt-2 text-[11px] text-[#737b75]">Forsíðumynd birtist á eignayfirliti og í gáttum.</p></div>
      {canEdit && <form onSubmit={uploadImage} className="flex flex-wrap items-center gap-3"><FileUpload key={uploadKey} name="file" accept="image/jpeg,image/png,image/webp,image/avif" required multiple disabled={controlsDisabled} presentation="action" chooseLabel="Velja myndir" emptyLabel="Engar myndir valdar" className="w-full sm:w-[280px]" /><Checkbox name="isCover" checked={cover} onChange={setCover} disabled={controlsDisabled} label="Fyrsta mynd sem forsíða" className="text-[11px] text-[var(--text-secondary)]" /><Button type="submit" variant="primary" disabled={controlsDisabled}><Upload size={14} />{uploading ? "Hleð upp…" : "Hlaða upp myndum"}</Button></form>}
    </div>
    {result && <p role="status" className="mt-4 text-[12px] text-[#55704f]">{result}</p>}
    {error && <p role="alert" className="mt-4 text-[12px] text-[#a24f48]">{error}</p>}
    {imageItems.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{imageItems.map((image, index) => <article key={image.id} className="overflow-hidden rounded-[14px] border border-black/[0.07] bg-white shadow-[0_4px_16px_rgba(25,34,24,0.04)]"><div className="relative aspect-[4/3] bg-[var(--surface-soft)]">{image.url ? <Image unoptimized fill sizes="220px" src={image.url} alt="" className="object-cover" /> : null}{image.isCover && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-medium text-[#3f594c] shadow-sm">Forsíða</span>}</div>{canEdit && <div className="flex items-center justify-between p-1.5"><Button variant="icon" size="icon" title="Færa til vinstri" aria-label="Færa til vinstri" disabled={controlsDisabled || index === 0} onClick={() => void moveImage(index, -1)}><ArrowLeft size={14} /></Button><Button variant="icon" size="icon" title="Velja sem forsíðu" aria-label="Velja sem forsíðu" disabled={controlsDisabled || image.isCover} onClick={() => void chooseCover(image.id)}><Star size={14} /></Button><Button variant="icon" size="icon" title="Færa til hægri" aria-label="Færa til hægri" disabled={controlsDisabled || index === imageItems.length - 1} onClick={() => void moveImage(index, 1)}><ArrowRight size={14} /></Button><Button variant="danger" size="icon" title="Eyða mynd" aria-label="Eyða mynd" disabled={controlsDisabled} onClick={() => void removeImage(image.id)} className="min-h-9 min-w-9"><Trash2 size={17} /></Button></div>}</article>)}</div> : <p className="mt-6 rounded-[12px] bg-[var(--surface-soft)] px-4 py-7 text-[12px] text-[var(--text-secondary)]">Engar myndir skráðar.</p>}
  </section>;
}
