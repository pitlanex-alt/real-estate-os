"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "./Popover";

const monthNames = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const weekdays = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];

function todayInIceland() {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Atlantic/Reykjavik", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
}

function serializeDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const date = parseDate(value);
  return date ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}` : "Veldu dagsetningu";
}

function accessibleDateLabel(date: Date) {
  const stableDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  return new Intl.DateTimeFormat("is-IS", { dateStyle: "long", timeZone: "Atlantic/Reykjavik" }).format(stableDate);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePicker({ value, onChange, name, id, ariaLabel, disabled = false, required = false, closeOnSelect = true, className = "" }: { value: string; onChange: (value: string) => void; name?: string; id?: string; ariaLabel?: string; disabled?: boolean; required?: boolean; closeOnSelect?: boolean; className?: string }) {
  const generated = useId();
  const controlId = id ?? `mo-date-${generated.replaceAll(":", "")}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDate(value);
  const icelandToday = todayInIceland();
  const initialDate = selectedDate ?? icelandToday;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12));
  const [activeDate, setActiveDate] = useState(initialDate);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  useEffect(() => {
    if (!open) return;
    const key = serializeDate(activeDate);
    requestAnimationFrame(() => dayRefs.current.get(key)?.focus());
  }, [activeDate, open, visibleMonth]);

  function openCalendar() {
    if (disabled) return;
    const next = selectedDate ?? todayInIceland();
    setActiveDate(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
    setOpen(true);
  }

  function moveActive(daysToAdd: number) {
    const next = new Date(activeDate);
    next.setDate(next.getDate() + daysToAdd);
    setActiveDate(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
  }

  function choose(date: Date) {
    onChange(serializeDate(date));
    setActiveDate(date);
    if (closeOnSelect) close();
  }

  function dayKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const movements: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in movements) { event.preventDefault(); moveActive(movements[event.key]); }
    else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = new Date(activeDate);
      next.setMonth(next.getMonth() + (event.key === "PageDown" ? 1 : -1));
      setActiveDate(next); setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
    } else if (event.key === "Escape") { event.preventDefault(); close(); }
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button ref={triggerRef} id={controlId} type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => open ? close(false) : openCalendar()} onKeyDown={(event) => event.key === "Escape" && open && close()} className={`mo-control flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-base ${open ? "mo-control-open" : ""}`}>
        <span className={value ? "text-[#dedfd8]" : "text-[#636b65]"}>{displayDate(value)}</span>
        <CalendarDays size={15} className="shrink-0 text-[#788079]" />
      </button>
      <Popover open={open} onClose={close} triggerRef={triggerRef} minWidth={300} labelledBy={controlId}>
        <div role="dialog" aria-modal="false" aria-label="Veldu dagsetningu" className="p-3">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Fyrri mánuður" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12))} className="mo-button mo-button-icon grid size-10 place-items-center"><ChevronLeft size={17} /></button>
            <p className="text-[13px] font-medium capitalize text-[#dedfd8]">{monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</p>
            <button type="button" aria-label="Næsti mánuður" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12))} className="mo-button mo-button-icon grid size-10 place-items-center"><ChevronRight size={17} /></button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center">{weekdays.map((day) => <span key={day} className="py-2 text-[9px] font-medium uppercase tracking-[0.04em] text-[#687069]">{day}</span>)}</div>
          <div className="grid grid-cols-7" role="grid">
            {days.map((date) => {
              const key = serializeDate(date);
              const outside = date.getMonth() !== visibleMonth.getMonth();
              const selected = selectedDate ? sameDay(date, selectedDate) : false;
              const today = sameDay(date, icelandToday);
              const active = sameDay(date, activeDate);
              return <button ref={(node) => { if (node) dayRefs.current.set(key, node); else dayRefs.current.delete(key); }} key={key} type="button" role="gridcell" tabIndex={active ? 0 : -1} aria-selected={selected} aria-label={accessibleDateLabel(date)} onFocus={() => setActiveDate(date)} onKeyDown={dayKeyDown} onClick={() => choose(date)} className={`mo-calendar-day grid size-10 place-items-center rounded-[7px] text-[12px] ${selected ? "bg-[#6f846f] font-semibold text-[#111412]" : outside ? "text-[#4f5751]" : "text-[#afb4ae]"} ${today && !selected ? "ring-1 ring-inset ring-[#6f846f]/55" : ""}`}>{date.getDate()}</button>;
            })}
          </div>
        </div>
      </Popover>
    </div>
  );
}
