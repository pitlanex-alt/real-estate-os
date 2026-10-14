"use client";

import { CalendarPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { DateTimePicker } from "@/app/components/ui/DateTimePicker";
import { Select } from "@/app/components/ui/Select";
import { createPropertyViewing, type ViewingCreateState } from "../actions";

const viewingTypes = [
  { value: "open_house", label: "Opið hús" },
  { value: "private", label: "Einkaskoðun" },
];

export function ViewingScheduleForm({
  propertySlug,
  transactionId,
  stage,
}: {
  propertySlug: string;
  transactionId: string;
  stage: string;
}) {
  const [viewingType, setViewingType] = useState("open_house");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const action = createPropertyViewing.bind(null, propertySlug, transactionId);
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    success: null,
  } satisfies ViewingCreateState);

  return (
    <section className="kelvo-card mt-6 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-accent)] text-[#60765d]">
          <CalendarPlus size={17} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Skrá skoðun</h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[var(--text-secondary)]">
            {stage === "listed"
              ? "Fyrsta skráða skoðunin færir ferlið sjálfkrafa og sýnilega úr Á sölu í Skoðanir."
              : "Skráðu næsta tíma og opnaðu síðan skoðunina til að halda utan um gesti og eftirfylgni."}
          </p>
        </div>
      </div>
      <form action={formAction} className="mt-5 grid gap-4 border-t border-black/[0.06] pt-5 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="block text-[11px] text-[var(--text-secondary)]">
          Tegund
          <Select
            name="viewingType"
            ariaLabel="Tegund skoðunar"
            value={viewingType}
            onChange={setViewingType}
            options={viewingTypes}
            size="compact"
            className="mt-2"
          />
        </label>
        <label className="block text-[11px] text-[var(--text-secondary)]">
          Hefst
          <DateTimePicker
            name="startsAt"
            value={startsAt}
            onChange={setStartsAt}
            ariaLabel="Upphaf skoðunar"
            required
            size="compact"
            className="mt-2"
          />
        </label>
        <label className="block text-[11px] text-[var(--text-secondary)]">
          Lýkur
          <DateTimePicker
            name="endsAt"
            value={endsAt}
            onChange={setEndsAt}
            ariaLabel="Lok skoðunar"
            required
            size="compact"
            className="mt-2"
          />
        </label>
        <Button type="submit" variant="primary" disabled={pending} className="min-h-10 whitespace-nowrap px-4 text-[12px]">
          {pending ? "Skrái…" : "Skrá skoðun"}
        </Button>
      </form>
      {state.error && <p role="alert" className="mt-4 text-[11px] text-[#914b45]">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 text-[11px] text-[#60765d]">{state.success}</p>}
    </section>
  );
}
