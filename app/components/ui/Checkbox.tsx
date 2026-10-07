"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

export function Checkbox({ checked, onChange, name, value = "on", label, id, disabled = false, className = "" }: { checked: boolean; onChange: (checked: boolean) => void; name?: string; value?: string; label: ReactNode; id?: string; disabled?: boolean; className?: string }) {
  const generated = useId();
  const inputId = id ?? `mo-checkbox-${generated.replaceAll(":", "")}`;
  return (
    <label htmlFor={inputId} className={`mo-checkbox-label flex min-h-11 items-center gap-3 ${disabled ? "opacity-50" : ""} ${className}`}>
      <input id={inputId} type="checkbox" name={name} value={value} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-[4px] border border-white/[0.16] bg-[#151916] text-[#111412] transition-colors peer-checked:border-[#829782] peer-checked:bg-[#829782] peer-focus-visible:ring-2 peer-focus-visible:ring-[#9caf9a]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#111412]">
        {checked && <Check size={13} strokeWidth={2.6} />}
      </span>
      <span>{label}</span>
    </label>
  );
}
