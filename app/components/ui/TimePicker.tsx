"use client";

import { Select, type SelectOption } from "./Select";

function timeOptions(value: string) {
  const options: SelectOption[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ value: time, label: time });
    }
  }
  if (value && !options.some((option) => option.value === value)) options.push({ value, label: value });
  return options.sort((a, b) => a.value.localeCompare(b.value));
}

export function TimePicker({ value, onChange, name, id, ariaLabel = "Veldu tíma", disabled = false, required = false, className = "" }: { value: string; onChange: (value: string) => void; name?: string; id?: string; ariaLabel?: string; disabled?: boolean; required?: boolean; className?: string }) {
  return <Select options={timeOptions(value)} value={value} onChange={onChange} name={name} id={id} ariaLabel={ariaLabel} placeholder="Veldu tíma" disabled={disabled} required={required} className={className} />;
}
