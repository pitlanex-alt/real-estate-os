"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "./Popover";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string | null;
  disabled?: boolean;
};

const maximumVisibleOptions = 12;

export function Combobox({
  options,
  value,
  onChange,
  name,
  ariaLabel,
  placeholder = "Leita…",
  emptyMessage = "Engar niðurstöður fundust.",
  disabled = false,
  required = false,
  size = "normal",
  className = "",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  ariaLabel: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "normal" | "compact";
  className?: string;
}) {
  const generatedId = useId().replaceAll(":", "");
  const triggerId = `kelvo-combobox-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("is-IS");
    return options
      .filter((option) => !normalized || `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("is-IS").includes(normalized))
      .slice(0, maximumVisibleOptions);
  }, [options, query]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function openMenu() {
    if (disabled) return;
    setActiveIndex(0);
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function choose(index: number) {
    const option = visibleOptions[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function move(direction: 1 | -1) {
    if (!visibleOptions.length) return;
    setActiveIndex((current) => {
      for (let step = 1; step <= visibleOptions.length; step += 1) {
        const next = (current + direction * step + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next]?.disabled) return next;
      }
      return current;
    });
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Enter") { event.preventDefault(); choose(activeIndex); }
    else if (event.key === "Tab") close(false);
  }

  return <div className={`relative min-w-0 ${className}`}>
    {name && <input type="hidden" name={name} value={value} required={required} />}
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-controls={listboxId}
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={() => open ? close(false) : openMenu()}
      onKeyDown={onTriggerKeyDown}
      className={`mo-control flex w-full items-center justify-between gap-3 text-left ${size === "compact" ? "min-h-10 rounded-[10px] px-2.5 text-[11px]" : "min-h-12 px-4 text-base"} ${open ? "mo-control-open" : ""}`}
    >
      <span className={`truncate ${selected ? "text-[#252925]" : "text-[#9ba19a]"}`}>{selected?.label ?? placeholder}</span>
      <ChevronsUpDown size={15} className="shrink-0 text-[#858c84]" />
    </button>
    <Popover open={open} onClose={close} triggerRef={triggerRef} minWidth={260} labelledBy={triggerId}>
      <div className="sticky top-0 z-10 border-b border-black/[0.06] bg-white p-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={onSearchKeyDown}
            aria-label={ariaLabel}
            aria-controls={listboxId}
            aria-activedescendant={visibleOptions.length ? `${triggerId}-option-${activeIndex}` : undefined}
            placeholder={placeholder}
            className="mo-control min-h-10 w-full rounded-[10px] pl-9 pr-3 text-[13px] outline-none"
          />
        </div>
      </div>
      <div id={listboxId} role="listbox" aria-label={ariaLabel} className="p-1.5">
        {visibleOptions.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return <button
            id={`${triggerId}-option-${index}`}
            key={option.value}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={isSelected}
            disabled={option.disabled}
            onPointerMove={() => !option.disabled && setActiveIndex(index)}
            onClick={() => choose(index)}
            className={`mo-select-option flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left ${isSelected ? "bg-[#e8f0e3]" : isActive ? "bg-[#f2f5ef]" : ""}`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{option.label}</span>
              {option.description && <span className="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">{option.description}</span>}
            </span>
            {isSelected && <Check size={14} className="shrink-0 text-[#5e744f]" />}
          </button>;
        })}
        {!visibleOptions.length && <p className="px-3 py-6 text-center text-[12px] text-[var(--text-secondary)]">{emptyMessage}</p>}
      </div>
    </Popover>
  </div>;
}
