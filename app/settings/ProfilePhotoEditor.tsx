"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/app/components/ui/Button";

const outputSize = 512;

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value));
}

export function ProfilePhotoEditor({ source, onCancel, onSave }: { source: string; onCancel: () => void; onSave: (file: File) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize(viewport.getBoundingClientRect().width);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const baseScale = naturalSize.width && naturalSize.height ? Math.max(viewportSize / naturalSize.width, viewportSize / naturalSize.height) : 1;
  const renderedWidth = naturalSize.width * baseScale * zoom;
  const renderedHeight = naturalSize.height * baseScale * zoom;
  const maxX = Math.max(0, (renderedWidth - viewportSize) / 2);
  const maxY = Math.max(0, (renderedHeight - viewportSize) / 2);
  const safeOffset = { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) };

  const moveTo = useCallback((x: number, y: number) => setOffset({ x: clamp(x, maxX), y: clamp(y, maxY) }), [maxX, maxY]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: safeOffset.x, offsetY: safeOffset.y };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    moveTo(drag.offsetX + event.clientX - drag.x, drag.offsetY + event.clientY - drag.y);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const amount = event.shiftKey ? 16 : 5;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    moveTo(safeOffset.x + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0), safeOffset.y + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0));
  }

  async function save() {
    const image = imageRef.current;
    if (!image || !naturalSize.width) return;
    setSaving(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      const ratio = outputSize / viewportSize;
      context.drawImage(image, outputSize / 2 - renderedWidth * ratio / 2 + safeOffset.x * ratio, outputSize / 2 - renderedHeight * ratio / 2 + safeOffset.y * ratio, renderedWidth * ratio, renderedHeight * ratio);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
      if (!blob) throw new Error("encode");
      onSave(new File([blob], "profilmynd.webp", { type: "image/webp", lastModified: Date.now() }));
    } catch {
      setError("Ekki tókst að vinna myndina. Prófaðu að velja aðra mynd.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#171a17]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-photo-editor-title">
      <section className="w-full max-w-[560px] rounded-[20px] border border-black/[0.08] bg-white p-5 shadow-[0_20px_60px_rgba(20,25,20,0.16)] sm:p-7">
        <h2 id="profile-photo-editor-title" className="text-[20px] font-bold tracking-[-0.03em] text-[var(--text-primary)]">Stilla prófílmynd</h2>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">Dragðu myndina til eða notaðu örvatakkana. Hringurinn sýnir hvernig myndin birtist.</p>
        <div className="mt-6 grid place-items-center">
          <div ref={viewportRef} tabIndex={0} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} className="relative aspect-square w-[min(76vw,320px)] touch-none cursor-grab overflow-hidden rounded-full bg-[var(--surface-soft)] outline-none ring-4 ring-[var(--surface-accent)] focus-visible:ring-[var(--accent)] active:cursor-grabbing" aria-label="Staðsetning prófílmyndar">
            {/* A plain img is intentional: canvas needs the decoded source element. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imageRef} src={source} crossOrigin="anonymous" draggable={false} alt="Forskoðun prófílmyndar" onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: renderedWidth || undefined, height: renderedHeight || undefined, transform: `translate(calc(-50% + ${safeOffset.x}px), calc(-50% + ${safeOffset.y}px))` }} />
          </div>
        </div>
        <label className="mt-7 block text-[11px] font-medium text-[var(--text-secondary)]">Aðdráttur<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-3 h-2 w-full cursor-pointer accent-[#9eb33f]" /></label>
        {error && <p role="alert" className="mt-4 text-[12px] text-[#a24f48]">{error}</p>}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onCancel} disabled={saving}>Hætta við</Button><Button variant="primary" onClick={() => void save()} disabled={saving || !naturalSize.width}>{saving ? "Vinn mynd…" : "Vista mynd"}</Button></div>
      </section>
    </div>
  );
}
