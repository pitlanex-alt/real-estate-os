"use client";

import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";

function parts(value: string) {
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? "";
  const time = /T(\d{2}:\d{2})/.exec(value)?.[1] ?? "";
  return { date, time };
}

export function toIcelandDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Atlantic/Reykjavik", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function DateTimePicker({ value, onChange, name, id, ariaLabel = "Dagsetning og tími", disabled = false, required = false, error = false, className = "", size = "normal" }: { value: string; onChange: (value: string) => void; name?: string; id?: string; ariaLabel?: string; disabled?: boolean; required?: boolean; error?: boolean; className?: string; size?: "normal" | "compact" }) {
  const current = parts(value);
  function update(date: string, time: string) { onChange(date && time ? `${date}T${time}` : date ? `${date}T` : time ? `T${time}` : ""); }
  return (
    <div className={`grid min-w-0 grid-cols-[minmax(0,1.25fr)_minmax(92px,.75fr)] gap-2 ${className}`} role="group" aria-label={ariaLabel}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <DatePicker id={id ? `${id}-date` : undefined} value={current.date} onChange={(date) => update(date, current.time || "09:00")} ariaLabel={`${ariaLabel}, dagsetning`} disabled={disabled} className={error ? "[&_.mo-control]:border-[#c99a52]/50" : ""} size={size} />
      <TimePicker id={id ? `${id}-time` : undefined} value={current.time} onChange={(time) => update(current.date, time)} ariaLabel={`${ariaLabel}, tími`} disabled={disabled} className={error ? "[&_.mo-control]:border-[#c99a52]/50" : ""} size={size} />
    </div>
  );
}
