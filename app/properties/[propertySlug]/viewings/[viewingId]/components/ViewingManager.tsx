"use client";

import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  attendanceOptions,
  interestOptions,
  nextActionOptions,
  type AttendanceStatus,
  type InterestLevel,
  type ViewingDetails,
  type ViewingGuest,
} from "@/app/data/viewing";
import {
  addWalkInGuestAction,
  completeViewingAction,
  updateViewingGuestAction,
} from "../actions";

const attendanceLabels: Record<AttendanceStatus, string> = {
  registered: "Skráður",
  attended: "Mættur",
  absent: "Mætti ekki",
};

const interestLabels: Record<InterestLevel, string> = {
  very: "Mjög áhugasamur",
  interested: "Áhugasamur",
  unsure: "Ekki viss",
  "not-interested": "Ekki áhugasamur",
  unset: "Ekki skráð",
};

const interestStyles: Record<InterestLevel, string> = {
  very: "text-[#afbeac]",
  interested: "text-[#909c90]",
  unsure: "text-[#b99a68]",
  "not-interested": "text-[#777e78]",
  unset: "text-[#555d57]",
};

type WalkInForm = {
  name: string;
  phone: string;
  email: string;
};

const emptyWalkIn: WalkInForm = { name: "", phone: "", email: "" };

const viewingStatusLabels: Record<ViewingDetails["status"], string> = {
  scheduled: "Áætluð",
  active: "Í gangi",
  completed: "Lokið",
  cancelled: "Hætt við",
};

function StatusDot({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`size-1.5 shrink-0 rounded-full ${
        status === "attended" ? "bg-[#829782]" : status === "absent" ? "bg-[#a85d55]" : "bg-[#7d6a4a]"
      }`}
    />
  );
}

function ViewingHeader({
  viewing,
  propertySlug,
  registered,
  attended,
  noShow,
  onAddGuest,
}: {
  viewing: ViewingDetails;
  propertySlug: string;
  registered: number;
  attended: number;
  noShow: number;
  onAddGuest: () => void;
}) {
  return (
    <header>
      <Link href={`/properties/${propertySlug}`} className="inline-flex min-h-11 items-center gap-1.5 text-[11px] font-medium text-[#778079] hover:text-[#b5bbb6]">
        <ChevronLeft size={14} strokeWidth={1.7} />
        {viewing.address}
      </Link>

      <div className="mt-3 flex flex-col gap-6 border-b border-white/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-[#f3f1ea]">{viewing.title}</h1>
            <span className="rounded-full border border-[#6f846f]/30 bg-[#6f846f]/10 px-2.5 py-1 text-[10px] font-medium text-[#a9b8a7]">{viewingStatusLabels[viewing.status]}</span>
          </div>
          <p className="mt-2 text-[12px] text-[#7a827c]">{viewing.dateTimeLabel}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#818983]">
            <span><strong className="font-semibold text-[#d8d8d1]">{registered}</strong> skráðir</span>
            <span><strong className="font-semibold text-[#d8d8d1]">{attended}</strong> mættir</span>
            <span><strong className="font-semibold text-[#d8d8d1]">{noShow}</strong> mættu ekki</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddGuest}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#6f846f] px-4 text-[13px] font-semibold text-[#111412] transition-colors hover:bg-[#829782]"
        >
          <Plus size={15} strokeWidth={2} />
          Skrá gest
        </button>
      </div>
    </header>
  );
}

function StatusStrip({ guests }: { guests: ViewingGuest[] }) {
  const attended = guests.filter((guest) => guest.attendance === "attended").length;
  const noShow = guests.filter((guest) => guest.attendance === "absent").length;
  const veryInterested = guests.filter((guest) => guest.interest === "very").length;
  const items = [
    { value: guests.length, label: "skráðir" },
    { value: attended, label: "mættir" },
    { value: noShow, label: "mættu ekki" },
    { value: veryInterested, label: "mjög áhugasamir" },
  ];

  return (
    <section aria-label="Staða skoðunar" className="grid grid-cols-2 border-b border-white/[0.07] sm:grid-cols-4 sm:divide-x sm:divide-white/[0.07]">
      {items.map((item, index) => (
        <div key={item.label} className={`${index % 2 === 1 ? "border-l border-white/[0.07]" : ""} ${index > 1 ? "border-t border-white/[0.07] sm:border-t-0" : ""} py-4 sm:border-l-0 sm:px-5 sm:first:pl-0`}>
          <span className="text-[19px] font-semibold tracking-[-0.035em] text-[#edebe4]">{item.value}</span>
          <span className="ml-2 text-[10.5px] text-[#747c76]">{item.label}</span>
        </div>
      ))}
    </section>
  );
}

function GuestRow({
  guest,
  onOpen,
  onMarkAttended,
}: {
  guest: ViewingGuest;
  onOpen: (guest: ViewingGuest) => void;
  onMarkAttended: (id: string) => void;
}) {
  const attendanceLabel = guest.attendanceLabel ?? attendanceLabels[guest.attendance];
  const interestLabel = guest.interestLabel ?? interestLabels[guest.interest];

  return (
    <li className="grid gap-3 border-b border-white/[0.07] py-3 md:grid-cols-[minmax(0,1fr)_154px] md:items-center md:gap-5">
      <button
        type="button"
        onClick={() => onOpen(guest)}
        className="group grid min-h-14 min-w-0 gap-3 text-left md:grid-cols-[1.1fr_0.72fr_0.82fr_1.3fr] md:items-center md:gap-5"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[12px] font-medium text-[#e8e7e0]">{guest.name}</span>
            {guest.walkIn && <span className="text-[8px] uppercase tracking-[0.08em] text-[#687569]">Óskráður gestur</span>}
          </span>
          <span className="mt-1 block text-[10px] tabular-nums text-[#707872]">{guest.phone}</span>
        </span>
        <span className="flex items-center gap-2 text-[10px] text-[#8c948e]">
          <StatusDot status={guest.attendance} />
          {attendanceLabel}
        </span>
        <span className={`text-[10px] ${interestStyles[guest.interest]}`}>{interestLabel}</span>
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="line-clamp-2 text-[10px] leading-4 text-[#69716b]">{guest.note || "Engar glósur skráðar."}</span>
          <ChevronRight size={15} strokeWidth={1.5} className="shrink-0 text-[#4f5751] transition group-hover:translate-x-0.5 group-hover:text-[#9caf9a]" />
        </span>
      </button>

      {guest.attendance === "attended" ? (
        <span className="flex min-h-11 items-center justify-center gap-2 text-[10px] font-medium text-[#849284] md:justify-start">
          <Check size={13} strokeWidth={2} />
          Mæting skráð
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMarkAttended(guest.id)}
          className="min-h-11 rounded-[8px] border border-[#6f846f]/35 px-3 text-[12px] font-medium text-[#a6b4a4] transition-colors hover:bg-[#6f846f]/10"
        >
          Merkja mættan
        </button>
      )}
    </li>
  );
}

function GuestList({
  guests,
  onOpen,
  onMarkAttended,
}: {
  guests: ViewingGuest[];
  onOpen: (guest: ViewingGuest) => void;
  onMarkAttended: (id: string) => void;
}) {
  return (
    <section className="mt-9" aria-labelledby="guest-list-heading">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="guest-list-heading" className="text-[16px] font-semibold tracking-[-0.02em] text-[#ecebe4]">Skráðir gestir</h2>
        <span className="text-[10px] text-[#626a64]">{guests.length} alls</span>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_154px] gap-5 border-y border-white/[0.07] py-2.5 text-[8.5px] font-medium uppercase tracking-[0.08em] text-[#59615b] md:grid">
        <div className="grid grid-cols-[1.1fr_0.72fr_0.82fr_1.3fr] gap-5">
          <span>Gestur</span>
          <span>Mæting</span>
          <span>Áhugi</span>
          <span>Glósur / næsta skref</span>
        </div>
        <span>Aðgerð</span>
      </div>
      <ul className="border-t border-white/[0.07] md:border-t-0">
        {guests.map((guest) => (
          <GuestRow key={guest.id} guest={guest} onOpen={onOpen} onMarkAttended={onMarkAttended} />
        ))}
      </ul>
    </section>
  );
}

function GuestDetailPanel({
  guest,
  onClose,
  onSave,
}: {
  guest: ViewingGuest;
  onClose: () => void;
  onSave: (guest: ViewingGuest) => void;
}) {
  const [draft, setDraft] = useState(guest);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/65" aria-label="Loka upplýsingum" />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-white/[0.08] bg-[#141815] sm:max-w-[480px]" aria-label={`Upplýsingar um ${guest.name}`}>
        <div className="flex items-start justify-between border-b border-white/[0.07] px-5 py-5 sm:px-7">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#eeede6]">{guest.name}</h2>
            <p className="mt-2 text-[12px] text-[#808882]">{guest.phone} · {guest.email}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-[8px] text-[#858d87] hover:bg-white/5 hover:text-white" aria-label="Loka">
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          <fieldset>
            <legend className="text-[11px] font-medium uppercase tracking-[0.09em] text-[#69716b]">Mæting</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {attendanceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, attendance: option.value, attendanceLabel: undefined })}
                  className={`min-h-11 rounded-[8px] border px-2 text-[12px] font-medium ${draft.attendance === option.value ? "border-[#6f846f]/60 bg-[#6f846f]/12 text-[#b9c6b6]" : "border-white/[0.08] text-[#747c76]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-7">
            <legend className="text-[11px] font-medium uppercase tracking-[0.09em] text-[#69716b]">Áhugi</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {interestOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, interest: option.value, interestLabel: undefined })}
                  className={`min-h-11 rounded-[8px] border px-3 text-left text-[12px] font-medium ${draft.interest === option.value ? "border-[#6f846f]/60 bg-[#6f846f]/12 text-[#b9c6b6]" : "border-white/[0.08] text-[#747c76]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7">
            <label htmlFor="guest-notes" className="text-[11px] font-medium uppercase tracking-[0.09em] text-[#69716b]">Glósur eftir skoðun</label>
            <textarea
              id="guest-notes"
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              rows={4}
              placeholder="Skráðu stutta glósu..."
              className="mt-3 w-full resize-none rounded-[9px] border border-white/[0.08] bg-[#1a1f1b] p-3 text-base leading-6 text-[#dcddd6] outline-none placeholder:text-[#59615b] focus:border-[#6f846f]/60"
            />
          </div>

          <div className="mt-7">
            <label htmlFor="next-action" className="text-[11px] font-medium uppercase tracking-[0.09em] text-[#69716b]">Næsta aðgerð</label>
            <select
              id="next-action"
              value={draft.nextAction}
              onChange={(event) => setDraft({ ...draft, nextAction: event.target.value as ViewingGuest["nextAction"] })}
              className="mt-3 min-h-11 w-full rounded-[9px] border border-white/[0.08] bg-[#1a1f1b] px-3 text-base text-[#d6d8d1] outline-none focus:border-[#6f846f]/60"
            >
              {nextActionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-white/[0.07] px-5 py-4 sm:px-7">
          <button type="button" onClick={save} disabled={isSaving} className="min-h-11 w-full rounded-[8px] bg-[#6f846f] px-4 text-[14px] font-semibold text-[#111412] hover:bg-[#829782] disabled:cursor-wait disabled:opacity-60">{isSaving ? "Vista…" : "Vista"}</button>
        </div>
      </aside>
    </div>
  );
}

function AddGuestModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (guest: WalkInForm) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyWalkIn);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setIsSaving(true);
    await onAdd(form);
    setIsSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid items-end sm:place-items-center">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/65" aria-label="Loka skráningu" />
      <section className="relative w-full border-t border-white/[0.08] bg-[#151916] px-5 pb-6 pt-5 sm:max-w-[460px] sm:rounded-[12px] sm:border sm:px-7 sm:py-7" aria-labelledby="add-guest-heading">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#6f846f]">Óskráður gestur</p>
            <h2 id="add-guest-heading" className="mt-2 text-[19px] font-semibold text-[#eeede6]">Skrá gest</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-[8px] text-[#858d87] hover:bg-white/5" aria-label="Loka">
            <X size={19} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="walk-in-name" className="text-[12px] text-[#8b938d]">Nafn</label>
            <input id="walk-in-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 min-h-11 w-full rounded-[8px] border border-white/[0.08] bg-[#1b201c] px-3 text-base text-[#e2e2db] outline-none focus:border-[#6f846f]/60" />
          </div>
          <div>
            <label htmlFor="walk-in-phone" className="text-[12px] text-[#8b938d]">Sími</label>
            <input id="walk-in-phone" required inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 min-h-11 w-full rounded-[8px] border border-white/[0.08] bg-[#1b201c] px-3 text-base text-[#e2e2db] outline-none focus:border-[#6f846f]/60" />
          </div>
          <div>
            <label htmlFor="walk-in-email" className="text-[12px] text-[#8b938d]">Netfang <span className="text-[#626a64]">(valfrjálst)</span></label>
            <input id="walk-in-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 min-h-11 w-full rounded-[8px] border border-white/[0.08] bg-[#1b201c] px-3 text-base text-[#e2e2db] outline-none focus:border-[#6f846f]/60" />
          </div>
          <button type="submit" disabled={isSaving} className="min-h-11 w-full rounded-[8px] bg-[#6f846f] px-4 text-[14px] font-semibold text-[#111412] hover:bg-[#829782] disabled:cursor-wait disabled:opacity-60">{isSaving ? "Skrái gest…" : "Skrá sem mættan"}</button>
        </form>
      </section>
    </div>
  );
}

function CompleteViewing({
  guests,
  completed,
  onComplete,
}: {
  guests: ViewingGuest[];
  completed: boolean;
  onComplete: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const counts = useMemo(() => ({
    attended: guests.filter((guest) => guest.attendance === "attended").length,
    very: guests.filter((guest) => guest.interest === "very").length,
    interested: guests.filter((guest) => guest.interest === "interested").length,
    unsure: guests.filter((guest) => guest.interest === "unsure").length,
    notInterested: guests.filter((guest) => guest.interest === "not-interested").length,
  }), [guests]);

  if (completed) {
    return (
      <section className="mt-12 border-y border-[#6f846f]/25 bg-[#6f846f]/[0.06] py-7" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#6f846f]/15 text-[#9caf9a]"><Check size={15} strokeWidth={2} /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-[#dfe5dc]">Skoðun lokið</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#879188]">Staða, lokatími og innri virkni hafa verið skráð. Engin uppfærsla hefur verið send til seljanda.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-white/[0.07] pt-9" aria-labelledby="complete-heading">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h2 id="complete-heading" className="text-[16px] font-semibold text-[#ecebe4]">Ljúka skoðun</h2>
          <p className="mt-2 text-[10.5px] text-[#6f7771]">Farðu yfir mætingu og næstu aðgerðir áður en skoðun er lokað.</p>
        </div>
        {!isOpen && <button type="button" onClick={() => setIsOpen(true)} className="min-h-11 rounded-[8px] border border-white/[0.1] px-4 text-[13px] font-medium text-[#a8afa9] hover:border-white/[0.16] hover:text-white">Ljúka skoðun</button>}
      </div>

      {isOpen && (
        <div className="mt-7 border-y border-white/[0.07] py-6">
          <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-5 sm:divide-x sm:divide-white/[0.07]">
            {[
              [counts.attended, "mættu"],
              [counts.very, "mjög áhugasamir"],
              [counts.interested, "áhugasamir"],
              [counts.unsure, "ekki vissir"],
              [counts.notInterested, "ekki áhugasamur"],
            ].map(([value, label]) => (
              <div key={label} className="sm:px-4 sm:first:pl-0">
                <p className="text-[18px] font-semibold text-[#e6e5de]">{value}</p>
                <p className="mt-1 text-[9.5px] text-[#6f7771]">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-white/[0.07] pt-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[#687069]">Tillögur að eftirfylgni</p>
            <ul className="mt-4 space-y-2.5 text-[11px] text-[#9ba19b]">
              <li>3 kaupendur þarf að hafa samband við í dag</li>
              <li>1 kaupandi vill aðra skoðun</li>
              <li>1 kaupandi vantar staðfestingu á fjármögnun</li>
            </ul>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsOpen(false)} className="min-h-11 px-4 text-[13px] text-[#7c847e]">Til baka</button>
            <button type="button" onClick={async () => { setIsCompleting(true); await onComplete(); setIsCompleting(false); }} disabled={isCompleting} className="min-h-11 rounded-[8px] bg-[#6f846f] px-4 text-[13px] font-semibold text-[#111412] hover:bg-[#829782] disabled:cursor-wait disabled:opacity-60">{isCompleting ? "Lýk skoðun…" : "Ljúka skoðun"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ViewingManager({
  initialViewing,
  initialGuests,
  propertySlug,
}: {
  initialViewing: ViewingDetails;
  initialGuests: ViewingGuest[];
  propertySlug: string;
}) {
  const [viewing, setViewing] = useState(initialViewing);
  const [guests, setGuests] = useState(initialGuests);
  const [selectedGuest, setSelectedGuest] = useState<ViewingGuest | null>(null);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const attended = guests.filter((guest) => guest.attendance === "attended").length;
  const noShow = guests.filter((guest) => guest.attendance === "absent").length;

  async function markAttended(id: string) {
    const guest = guests.find((item) => item.id === id);
    if (!guest) return;
    setActionError(null);
    const updatedGuest = { ...guest, attendance: "attended" as const, attendanceLabel: undefined };
    const result = await updateViewingGuestAction(updatedGuest, `/properties/${propertySlug}/viewings/${viewing.id}`);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setGuests((current) => current.map((item) => item.id === id ? updatedGuest : item));
  }

  async function saveGuest(updatedGuest: ViewingGuest) {
    setActionError(null);
    const result = await updateViewingGuestAction(updatedGuest, `/properties/${propertySlug}/viewings/${viewing.id}`);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setGuests((current) => current.map((guest) => guest.id === updatedGuest.id ? updatedGuest : guest));
    setSelectedGuest(null);
  }

  async function addWalkIn(form: WalkInForm) {
    setActionError(null);
    const result = await addWalkInGuestAction({ viewingId: viewing.id, ...form }, `/properties/${propertySlug}/viewings/${viewing.id}`);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setGuests((current) => [...current, result.data]);
    setIsAddingGuest(false);
    setSelectedGuest(result.data);
  }

  async function completeViewing() {
    setActionError(null);
    const result = await completeViewingAction(viewing.id, `/properties/${propertySlug}/viewings/${viewing.id}`);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setViewing((current) => ({ ...current, status: "completed", completedAt: result.data.completedAt }));
  }

  return (
    <>
      <ViewingHeader viewing={viewing} propertySlug={propertySlug} registered={guests.length} attended={attended} noShow={noShow} onAddGuest={() => setIsAddingGuest(true)} />
      <StatusStrip guests={guests} />
      {actionError && <p role="alert" className="mt-6 border-y border-[#c8665b]/25 py-4 text-[11px] text-[#c99088]">{actionError}</p>}
      <GuestList guests={guests} onOpen={setSelectedGuest} onMarkAttended={markAttended} />
      <CompleteViewing guests={guests} completed={viewing.status === "completed"} onComplete={completeViewing} />

      {selectedGuest && <GuestDetailPanel key={selectedGuest.id} guest={selectedGuest} onClose={() => setSelectedGuest(null)} onSave={saveGuest} />}
      {isAddingGuest && <AddGuestModal onClose={() => setIsAddingGuest(false)} onAdd={addWalkIn} />}
    </>
  );
}
