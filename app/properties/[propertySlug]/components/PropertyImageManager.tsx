"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/app/components/ui/Button";
import { Checkbox } from "@/app/components/ui/Checkbox";
import type { PropertyImage } from "@/lib/property-images/server";
import { deletePropertyImage, reorderPropertyImage, setPropertyCover, uploadPropertyImage } from "../actions";

export function PropertyImageManager({ slug, images, canEdit }: { slug: string; images: PropertyImage[]; canEdit: boolean }) {
  const [cover, setCover] = useState(!images.length);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<void>) { setError(null); startTransition(async () => { try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Aðgerð mistókst."); } }); }
  return <section className="border-t border-white/[0.07] py-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[16px] font-semibold">Myndir</h2><p className="mt-2 text-[11px] text-[#737b75]">Forsíðumynd birtist á eignayfirliti og í gáttum.</p></div>
      {canEdit && <form action={(data) => run(() => uploadPropertyImage(slug, data))} className="flex flex-wrap items-center gap-3"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="max-w-[240px] text-[12px] text-[#8b938d] file:mr-3 file:rounded-[8px] file:border file:border-white/[0.08] file:bg-[#181c19] file:px-3 file:py-2 file:text-[#bcc4ba]" /><Checkbox name="isCover" checked={cover} onChange={setCover} label="Forsíða" className="text-[11px] text-[#89918b]" /><Button type="submit" variant="primary" disabled={pending} className="min-h-11 px-4 text-[12px]"><Upload size={14} />Hlaða upp</Button></form>}
    </div>
    {error && <p role="alert" className="mt-4 text-[12px] text-[#c98279]">{error}</p>}
    {images.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{images.map((image, index) => <article key={image.id} className="overflow-hidden rounded-[9px] border border-white/[0.08] bg-[#171b18]"><div className="relative aspect-[4/3] bg-[#252b27]">{image.url ? <Image unoptimized fill sizes="220px" src={image.url} alt="" className="object-cover" /> : null}{image.isCover && <span className="absolute left-2 top-2 rounded-full bg-[#111412]/90 px-2 py-1 text-[9px] text-[#b9c6b6]">Forsíða</span>}</div>{canEdit && <div className="flex items-center justify-between p-1.5"><Button variant="icon" aria-label="Færa til vinstri" disabled={pending || index === 0} onClick={() => run(() => reorderPropertyImage(slug, image.id, Math.max(0, image.sortOrder - 1)))} className="size-10"><ArrowLeft size={14} /></Button><Button variant="icon" aria-label="Velja sem forsíðu" disabled={pending || image.isCover} onClick={() => run(() => setPropertyCover(slug, image.id))} className="size-10"><Star size={14} /></Button><Button variant="icon" aria-label="Færa til hægri" disabled={pending || index === images.length - 1} onClick={() => run(() => reorderPropertyImage(slug, image.id, image.sortOrder + 1))} className="size-10"><ArrowRight size={14} /></Button><Button variant="danger" aria-label="Eyða mynd" disabled={pending} onClick={() => run(() => deletePropertyImage(slug, image.id))} className="size-10 border-transparent"><Trash2 size={14} /></Button></div>}</article>)}</div> : <p className="mt-6 border-y border-white/[0.07] py-7 text-[12px] text-[#737b75]">Engar myndir skráðar.</p>}
  </section>;
}
