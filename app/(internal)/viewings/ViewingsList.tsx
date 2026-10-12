"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/app/components/ui/Select";
import { formatIcelandicDateWithYear, formatIcelandicTime } from "@/lib/datetime/iceland";

export type ViewingListItem = {
  id: string;
  type: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  transactionStage: string;
  property: { slug: string; address: string; postalCode: string; municipality: string };
  registered: number;
  attended: number;
  veryInterested: number;
};

const filters = [
  { value: "upcoming", label: "Framundan" },
  { value: "past", label: "Liðnar" },
  { value: "completed", label: "Lokið" },
  { value: "all", label: "Allar" },
];

const statusLabels = { scheduled: "Áætluð", active: "Í gangi", completed: "Lokið", cancelled: "Hætt við" } as const;
const statusClasses = { scheduled: "bg-[#edf3e9] text-[#58704f]", active: "bg-[#e8f0e3] text-[#43563d]", completed: "bg-[#f0f2ef] text-[#747b73]", cancelled: "bg-[#f7e7e5] text-[#914b45]" } as const;

function displayedStatus(viewing: ViewingListItem, now: Date) {
  if (viewing.status === "completed" || viewing.status === "cancelled") return { label: statusLabels[viewing.status], className: statusClasses[viewing.status] };
  if (new Date(viewing.endsAt).getTime() < now.getTime()) return { label: "Liðin", className: statusClasses.completed };
  if (new Date(viewing.startsAt).getTime() <= now.getTime()) return { label: "Í gangi", className: statusClasses.active };
  return { label: statusLabels[viewing.status], className: statusClasses[viewing.status] };
}

export function ViewingsList({ viewings, nowIso }: { viewings: ViewingListItem[]; nowIso: string }) {
  const [filter, setFilter] = useState("upcoming");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const filtered = useMemo(() => viewings.filter((viewing) => {
    const completedTransaction = ["completed", "cancelled"].includes(viewing.transactionStage);
    const past = viewing.status === "completed" || new Date(viewing.endsAt).getTime() < now.getTime();
    return filter === "all"
      || (filter === "completed" && completedTransaction)
      || (!completedTransaction && filter === "past" && past)
      || (!completedTransaction && filter === "upcoming" && !past && viewing.status !== "cancelled");
  }), [filter, now, viewings]);

  return <>
    <div className="mt-6 flex justify-end"><Select ariaLabel="Sía skoðanir" value={filter} onChange={setFilter} options={filters} size="compact" className="w-full sm:w-[190px]" /></div>
    <section className="kelvo-card mt-3 overflow-hidden px-3 sm:px-4">
      {filtered.map((viewing) => {
        const displayStatus = displayedStatus(viewing, now);
        return <Link key={viewing.id} href={`/properties/${viewing.property.slug}/viewings/${viewing.id}?from=viewings`} className="group grid min-h-[84px] items-center gap-3 border-b border-black/[0.06] px-2 py-4 last:border-b-0 sm:grid-cols-[minmax(190px,1.35fr)_minmax(180px,1fr)_auto_auto] sm:gap-6">
          <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{viewing.property.address}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{viewing.property.postalCode} {viewing.property.municipality}</p></div>
          <div><p className="text-[11.5px] font-medium text-[#434943]">{viewing.type === "open_house" ? "Opið hús" : "Skoðun"}</p><p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">{formatIcelandicDateWithYear(viewing.startsAt)} · {formatIcelandicTime(viewing.startsAt)}–{formatIcelandicTime(viewing.endsAt)}</p></div>
          <div className="flex items-center gap-4 text-[10.5px] text-[var(--text-secondary)]"><span>{viewing.registered} skráðir</span><span>{viewing.attended} mættir</span><span>{viewing.veryInterested} mjög áhugasamir</span></div>
          <div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`${displayStatus.className} rounded-full px-2.5 py-1 text-[10px] font-semibold`}>{displayStatus.label}</span><ChevronRight size={15} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]" /></div>
        </Link>;
      })}
      {!filtered.length && <p className="py-12 text-center text-[12px] text-[var(--text-secondary)]">Engar skoðanir fundust.</p>}
    </section>
  </>;
}
