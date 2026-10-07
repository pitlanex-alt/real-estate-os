"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "./Popover";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function Select({ options, value, onChange, name, id, placeholder = "Veldu", disabled = false, required = false, ariaLabel, className = "", error = false }: { options: SelectOption[]; value: string; onChange: (value: string) => void; name?: string; id?: string; placeholder?: string; disabled?: boolean; required?: boolean; ariaLabel?: string; className?: string; error?: boolean }) {
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
        className={`mo-control flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-base ${error ? "mo-control-error" : ""} ${open ? "mo-control-open" : ""}`}
      >
        <span className={`truncate ${selected ? "text-[#dedfd8]" : "text-[#636b65]"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-[#788079] transition-transform ${open ? "rotate-180 text-[#9caf9a]" : ""}`} />
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
                className={`mo-select-option flex min-h-10 w-full items-center justify-between gap-3 rounded-[7px] px-3 text-left text-[13px] ${isSelected ? "bg-[#6f846f]/15 text-[#c6d1c3]" : isActive ? "bg-white/[0.045] text-[#e4e4dd]" : "text-[#9ba29c]"}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} className="text-[#9caf9a]" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
