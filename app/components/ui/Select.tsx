"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "./Popover";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function Select({ options, value, onChange, name, id, placeholder = "Veldu", disabled = false, required = false, ariaLabel, className = "", error = false, size = "normal" }: { options: SelectOption[]; value: string; onChange: (value: string) => void; name?: string; id?: string; placeholder?: string; disabled?: boolean; required?: boolean; ariaLabel?: string; className?: string; error?: boolean; size?: "normal" | "compact" }) {
  const generatedId = useId();
  const controlId = id ?? `mo-select-${generatedId.replaceAll(":", "")}`;
  const listboxId = `${controlId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selected = options[selectedIndex];

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function nextEnabled(start: number, direction: 1 | -1) {
    for (let step = 1; step <= options.length; step += 1) {
      const index = (start + direction * step + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return start;
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function openMenu() {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextEnabled(-1, 1));
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) { event.preventDefault(); close(); return; }
    if (event.key === "Tab" && open) { close(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { openMenu(); return; }
      setActiveIndex((index) => nextEnabled(index, event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) { event.preventDefault(); choose(activeIndex); }
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${controlId}-option-${activeIndex}` : undefined}
        aria-invalid={error || undefined}
        disabled={disabled}
        onClick={() => open ? close(false) : openMenu()}
        onKeyDown={onKeyDown}
        className={`mo-control flex w-full items-center justify-between gap-3 text-left ${size === "compact" ? "min-h-10 rounded-[10px] px-2.5 text-[11px]" : "min-h-12 px-4 text-base"} ${error ? "mo-control-error" : ""} ${open ? "mo-control-open" : ""}`}
      >
        <span className={`truncate ${selected ? "text-[#252925]" : "text-[#9ba19a]"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-[#858c84] transition-transform ${open ? "rotate-180 text-[#596c4e]" : ""}`} />
      </button>
      <Popover open={open} onClose={close} triggerRef={triggerRef} minWidth={180} labelledBy={controlId}>
        <div id={listboxId} role="listbox" aria-label={ariaLabel} className="p-1.5">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                id={`${controlId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                disabled={option.disabled}
                onPointerMove={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(index)}
                className={`mo-select-option flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-left text-[13px] ${isSelected ? "bg-[#e8f0e3] font-medium text-[#263023]" : isActive ? "bg-[#f2f5ef] text-[#2c312c]" : "text-[#6f756e]"}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} className="text-[#5e744f]" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
