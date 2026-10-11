"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";

export function FileUpload({ name, accept, required = false, disabled = false, multiple = false, presentation = "compact", chooseLabel = "Velja skrá", emptyLabel = "Engin skrá valin", dropLabel = "Dragðu skrá hingað eða veldu skrá", onFilesChange, className = "" }: { name: string; accept?: string; required?: boolean; disabled?: boolean; multiple?: boolean; presentation?: "compact" | "action" | "dropzone"; chooseLabel?: string; emptyLabel?: string; dropLabel?: string; onFilesChange?: (files: File[]) => void; className?: string }) {
  const generated = useId();
  const id = `kelvo-file-${generated.replaceAll(":", "")}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [fileLabel, setFileLabel] = useState("");
  const [dragging, setDragging] = useState(false);

  function selectFiles(files: File[]) {
    setFileLabel(files.length > 1 ? `${files.length} skrár valdar` : files[0]?.name ?? "");
    onFilesChange?.(files);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(Array.from(event.target.files ?? []));
  }

  function onDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled || !inputRef.current) return;
    const dropped = Array.from(event.dataTransfer.files);
    const files = multiple ? dropped : dropped.slice(0, 1);
    if (!files.length) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
    selectFiles(files);
  }

  function onKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    inputRef.current?.click();
  }

  const isDropzone = presentation === "dropzone";
  return <label htmlFor={id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} onKeyDown={onKeyDown} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className={`group block min-w-0 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[#7d9961]/70 focus-visible:ring-offset-2 ${disabled ? "opacity-50" : "cursor-pointer"} ${className}`}>
    <input ref={inputRef} id={id} name={name} type="file" accept={accept} required={required} disabled={disabled} multiple={multiple} onChange={onChange} className="sr-only" />
    <span className={`mo-control flex w-full items-center gap-3 ${isDropzone ? `min-h-24 border-dashed px-4 py-4 ${dragging ? "border-[#9db640] bg-[#f3f8dc] ring-2 ring-[#d9f65a]/35" : "bg-[var(--surface-soft)]"}` : presentation === "compact" ? "min-h-12 px-2" : "min-h-11 px-2"}`}>
      <span className={`min-w-0 flex-1 px-2 text-[12px] text-[var(--text-secondary)] ${isDropzone ? "text-center sm:text-left" : "truncate"}`}>{fileLabel || (isDropzone ? dropLabel : emptyLabel)}</span>
      <span className="mo-button mo-button-secondary min-h-9 shrink-0 px-3 text-[11px]"><Upload size={14} />{chooseLabel}</span>
    </span>
  </label>;
}
