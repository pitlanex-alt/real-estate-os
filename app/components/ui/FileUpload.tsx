"use client";

import { Upload } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";

export function FileUpload({ name, accept, required = false, disabled = false, presentation = "compact", chooseLabel = "Velja skrá", emptyLabel = "Engin skrá valin", className = "" }: { name: string; accept?: string; required?: boolean; disabled?: boolean; presentation?: "compact" | "action"; chooseLabel?: string; emptyLabel?: string; className?: string }) {
  const generated = useId();
  const id = `kelvo-file-${generated.replaceAll(":", "")}`;
  const [fileName, setFileName] = useState("");
  function onChange(event: ChangeEvent<HTMLInputElement>) { setFileName(event.target.files?.[0]?.name ?? ""); }
  return <label htmlFor={id} className={`group block min-w-0 ${disabled ? "opacity-50" : "cursor-pointer"} ${className}`}>
    <input id={id} name={name} type="file" accept={accept} required={required} disabled={disabled} onChange={onChange} className="sr-only" />
    <span className={`mo-control flex w-full items-center gap-3 ${presentation === "compact" ? "min-h-12 px-2" : "min-h-11 px-2"}`}>
      <span className="min-w-0 flex-1 truncate px-2 text-[12px] text-[var(--text-secondary)]">{fileName || emptyLabel}</span>
      <span className="mo-button mo-button-secondary min-h-9 shrink-0 px-3 text-[11px]"><Upload size={14} />{chooseLabel}</span>
    </span>
  </label>;
}
