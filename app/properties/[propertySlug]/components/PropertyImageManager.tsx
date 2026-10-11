"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { FileUpload } from "@/app/components/ui/FileUpload";
import type { PropertyImage } from "@/lib/property-images/server";
import { createClient } from "@/lib/supabase/client";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maximumImageBytes = 15 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const thumbnailTransform = { width: 560, height: 420, resize: "cover" as const, quality: 76 };

function validateImage(file: File) {
  if (!allowedImageTypes.has(file.type)) return `${file.name}: aðeins JPG, PNG, WebP og AVIF eru leyfð.`;
  if (file.size > maximumImageBytes) return `${file.name}: myndin er stærri en 15 MB.`;
  if (file.size === 0) return `${file.name}: skráin er tóm.`;
  return null;
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function sameImage(left: PropertyImage, right: PropertyImage) {
  return left.id === right.id
    && left.storagePath === right.storagePath
    && left.fileName === right.fileName
    && left.sortOrder === right.sortOrder
    && left.isCover === right.isCover
    && left.url === right.url
    && left.thumbnailUrl === right.thumbnailUrl;
}

const PropertyThumbnail = memo(function PropertyThumbnail({ image }: { image: PropertyImage }) {
  const preferredSource = image.thumbnailUrl ?? image.url;
  const [source, setSource] = useState(preferredSource);
  return <div className="relative aspect-[4/3] bg-[var(--surface-soft)]">
    {source ? <Image unoptimized fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px" src={source} alt={image.fileName} loading={image.isCover ? "eager" : "lazy"} decoding="async" onError={() => { if (source !== image.url) setSource(image.url); }} className="object-cover" /> : null}
    {image.isCover && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-medium text-[#3f594c] shadow-sm">Forsíða</span>}
  </div>;
});

const PropertyImageCard = memo(function PropertyImageCard({ image, index, total, canEdit, disabled, pending, onMove, onCover, onDelete }: {
  image: PropertyImage;
  index: number;
  total: number;
  canEdit: boolean;
  disabled: boolean;
  pending: boolean;
  onMove: (imageId: string, direction: -1 | 1) => void;
  onCover: (imageId: string) => void;
  onDelete: (imageId: string) => void;
}) {
  return <article className="overflow-hidden rounded-[14px] border border-black/[0.07] bg-white shadow-[0_4px_16px_rgba(25,34,24,0.04)]" style={{ contentVisibility: "auto", containIntrinsicSize: "260px" }}>
    <PropertyThumbnail key={image.thumbnailUrl ?? image.url ?? image.id} image={image} />
    {canEdit && <div className="flex items-center justify-between p-1.5">
      <Button variant="icon" size="icon" title="Færa til vinstri" aria-label="Færa til vinstri" disabled={disabled || pending || index === 0} onClick={() => onMove(image.id, -1)}><ArrowLeft size={14} /></Button>
      <Button variant="icon" size="icon" title="Velja sem forsíðu" aria-label="Velja sem forsíðu" disabled={disabled || pending || image.isCover} onClick={() => onCover(image.id)}><Star size={14} /></Button>
      <Button variant="icon" size="icon" title="Færa til hægri" aria-label="Færa til hægri" disabled={disabled || pending || index === total - 1} onClick={() => onMove(image.id, 1)}><ArrowRight size={14} /></Button>
      <Button variant="danger" size="icon" title="Eyða mynd" aria-label="Eyða mynd" disabled={disabled || pending} onClick={() => onDelete(image.id)} className="min-h-9 min-w-9"><Trash2 size={17} /></Button>
    </div>}
  </article>;
});

export function PropertyImageManager({ organizationId, propertyId, images, canEdit }: { organizationId: string; propertyId: string; images: PropertyImage[]; canEdit: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [imageItems, setImageItems] = useState(images);
  const imageItemsRef = useRef(images);
  const mutationBusyRef = useRef(false);
  const [cover, setCover] = useState(!images.length);
  const [uploadKey, setUploadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const updateItems = useCallback((next: PropertyImage[]) => {
    imageItemsRef.current = next;
    setImageItems(next);
  }, []);

  useEffect(() => {
    const currentById = new Map(imageItemsRef.current.map((image) => [image.id, image]));
    const next = images.map((image) => {
      const current = currentById.get(image.id);
      return current && sameImage(current, image) ? current : image;
    });
    if (next.length !== imageItemsRef.current.length || next.some((image, index) => image !== imageItemsRef.current[index])) updateItems(next);
  }, [images, updateItems]);

  async function uploadOne(file: File, makeCover: boolean): Promise<{ image: PropertyImage | null; error: string | null }> {
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
      if (uploadError) return { image: null, error: `${file.name}: ekki tókst að hlaða myndinni upp.` };
      uploaded = true;

      const { data, error: metadataError } = await supabase.rpc("create_property_image_record", {
        p_property_id: propertyId,
        p_storage_path: storagePath,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_file_size_bytes: file.size,
        p_is_cover: makeCover,
      });
      if (metadataError || !data) {
        const { error: cleanupError } = await supabase.storage.from("property-images").remove([storagePath]);
        return { image: null, error: cleanupError
          ? `${file.name}: skráning mistókst og ekki tókst að hreinsa upp upphleðsluna.`
          : `${file.name}: ekki tókst að vista myndina; upphleðslan var hreinsuð.` };
      }
      uploaded = false;

      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      const [original, thumbnail] = await Promise.all([
        supabase.storage.from("property-images").createSignedUrl(storagePath, 3600),
        supabase.storage.from("property-images").createSignedUrl(storagePath, 3600, { transform: thumbnailTransform }),
      ]);
      return { image: {
        id: String(row.id),
        propertyId: String(row.property_id),
        storagePath,
        fileName: file.name,
        sortOrder: Number(row.sort_order),
        isCover: Boolean(row.is_cover),
        url: original.data?.signedUrl ?? null,
        thumbnailUrl: thumbnail.data?.signedUrl ?? original.data?.signedUrl ?? null,
      }, error: null };
    } catch {
      const cleanupFailed = uploaded
        ? Boolean((await supabase.storage.from("property-images").remove([storagePath])).error)
        : false;
      return { image: null, error: cleanupFailed
        ? `${file.name}: upphleðsla rofnaði og ekki tókst að hreinsa upp.`
        : `${file.name}: upphleðsla rofnaði.` };
    }
  }

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

    const uploadedImages: PropertyImage[] = [];
    const remaining = [...validFiles];
    const needsCover = cover || imageItemsRef.current.length === 0;
    if (needsCover) {
      while (remaining.length && uploadedImages.length === 0) {
        const upload = await uploadOne(remaining.shift()!, true);
        if (upload.image) uploadedImages.push(upload.image);
        if (upload.error) failures.push(upload.error);
      }
    }
    const uploads = await mapConcurrent(remaining, 4, (file) => uploadOne(file, false));
    for (const upload of uploads) {
      if (upload.image) uploadedImages.push(upload.image);
      if (upload.error) failures.push(upload.error);
    }

    setUploading(false);
    if (uploadedImages.length) {
      const uploadedCover = uploadedImages.find((image) => image.isCover);
      const current = uploadedCover
        ? imageItemsRef.current.map((image) => image.isCover ? { ...image, isCover: false } : image)
        : imageItemsRef.current;
      const next = [...current, ...uploadedImages].sort((left, right) => left.sortOrder - right.sortOrder);
      updateItems(next);
      form.reset();
      setUploadKey((value) => value + 1);
      setCover(false);
      setResult(`${uploadedImages.length} ${uploadedImages.length === 1 ? "mynd var vistuð" : "myndir voru vistaðar"}.`);
    }
    if (failures.length) setError(`Sumar myndir voru ekki vistaðar. ${failures.join(" ")}`);
  }

  const moveImage = useCallback(async (imageId: string, direction: -1 | 1) => {
    if (mutationBusyRef.current) return;
    const previous = imageItemsRef.current;
    const index = previous.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= previous.length) return;
    const moving = previous[index];
    const neighbor = previous[targetIndex];
    const next = [...previous];
    next[index] = { ...neighbor, sortOrder: moving.sortOrder };
    next[targetIndex] = { ...moving, sortOrder: neighbor.sortOrder };
    updateItems(next);
    setError(null);
    setResult(null);
    mutationBusyRef.current = true;
    setPendingIds(new Set([moving.id, neighbor.id]));
    const { error: reorderError } = await supabase.rpc("reorder_property_image", {
      p_image_id: moving.id,
      p_sort_order: neighbor.sortOrder,
    });
    mutationBusyRef.current = false;
    setPendingIds(new Set());
    if (reorderError) {
      updateItems(previous);
      setError("Ekki tókst að færa myndina. Fyrri röð hefur verið endurheimt.");
    }
  }, [supabase, updateItems]);

  const chooseCover = useCallback(async (imageId: string) => {
    if (mutationBusyRef.current) return;
    const previous = imageItemsRef.current;
    const affected = previous.filter((image) => image.isCover || image.id === imageId).map((image) => image.id);
    const next = previous.map((image) => image.isCover !== (image.id === imageId) ? { ...image, isCover: image.id === imageId } : image);
    updateItems(next);
    setError(null);
    setResult(null);
    mutationBusyRef.current = true;
    setPendingIds(new Set(affected));
    const { error: coverError } = await supabase.rpc("set_property_image_cover", { p_image_id: imageId });
    mutationBusyRef.current = false;
    setPendingIds(new Set());
    if (coverError) {
      updateItems(previous);
      setError("Ekki tókst að velja forsíðumynd. Fyrra val hefur verið endurheimt.");
    }
  }, [supabase, updateItems]);

  const removeImage = useCallback(async (imageId: string) => {
    if (mutationBusyRef.current) return;
    const image = imageItemsRef.current.find((item) => item.id === imageId);
    if (!image) return;
    setError(null);
    setResult(null);
    setDeletingId(imageId);
    mutationBusyRef.current = true;
    const { error: storageError } = await supabase.storage.from("property-images").remove([image.storagePath]);
    if (storageError) {
      setError("Ekki tókst að eyða mynd úr geymslu.");
    } else {
      const { error: metadataError } = await supabase.rpc("delete_property_image_record", { p_image_id: imageId });
      if (metadataError) {
        setError("Mynd var fjarlægð en ekki tókst að hreinsa skráningu hennar.");
      } else {
        const remaining = imageItemsRef.current.filter((item) => item.id !== imageId);
        const next = image.isCover && remaining.length
          ? remaining.map((item, index) => item.isCover === (index === 0) ? item : { ...item, isCover: index === 0 })
          : remaining;
        updateItems(next);
        setCover(next.length === 0);
      }
    }
    mutationBusyRef.current = false;
    setDeletingId(null);
  }, [supabase, updateItems]);

  const controlsDisabled = uploading || deletingId !== null;

  return <section className="kelvo-card mt-6 p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[16px] font-semibold">Myndir</h2><p className="mt-2 text-[11px] text-[#737b75]">Forsíðumynd birtist á eignayfirliti og í gáttum.</p></div>
      {canEdit && <form onSubmit={uploadImage} className="flex flex-wrap items-center gap-3"><FileUpload key={uploadKey} name="file" accept="image/jpeg,image/png,image/webp,image/avif" required multiple disabled={controlsDisabled || pendingIds.size > 0} presentation="action" chooseLabel="Velja myndir" emptyLabel="Engar myndir valdar" className="w-full sm:w-[280px]" /><Checkbox name="isCover" checked={cover} onChange={setCover} disabled={controlsDisabled || pendingIds.size > 0} label="Fyrsta mynd sem forsíða" className="text-[11px] text-[var(--text-secondary)]" /><Button type="submit" variant="primary" disabled={controlsDisabled || pendingIds.size > 0}><Upload size={14} />{uploading ? "Hleð upp…" : "Hlaða upp myndum"}</Button></form>}
    </div>
    {result && <p role="status" className="mt-4 text-[12px] text-[#55704f]">{result}</p>}
    {error && <p role="alert" className="mt-4 text-[12px] text-[#a24f48]">{error}</p>}
    {imageItems.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{imageItems.map((image, index) => <PropertyImageCard key={image.id} image={image} index={index} total={imageItems.length} canEdit={canEdit} disabled={controlsDisabled} pending={pendingIds.has(image.id)} onMove={moveImage} onCover={chooseCover} onDelete={removeImage} />)}</div> : <p className="mt-6 rounded-[12px] bg-[var(--surface-soft)] px-4 py-7 text-[12px] text-[var(--text-secondary)]">Engar myndir skráðar.</p>}
  </section>;
}
