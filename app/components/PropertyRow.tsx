import { ChevronRight, FileWarning } from "lucide-react";
import Link from "next/link";
import type { Property } from "@/app/data/dashboard";

const imageStyles: Record<Property["imageVariant"], string> = {
  city: "property-image-city",
  coast: "property-image-coast",
  stone: "property-image-stone",
};

function PropertyMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold tabular-nums text-[#dddcd5]">{value}</p>
      <p className="mt-1 truncate text-[9px] uppercase tracking-[0.07em] text-[#69716b]">{label}</p>
    </div>
  );
}

export function PropertyRow({ property }: { property: Property }) {
  return (
    <li>
      <Link
        href={property.href ?? "#"}
        className="group grid min-h-[104px] grid-cols-[72px_minmax(190px,1.45fr)_minmax(170px,1fr)_190px_160px_20px] items-center gap-5 border-b border-white/[0.07] px-1 py-4 transition-colors hover:bg-white/[0.018]"
      >
        <div
          role="img"
          aria-label={`Mynd af ${property.address}`}
          className={`property-image h-14 w-16 overflow-hidden rounded-[8px] border border-white/[0.08] xl:h-16 xl:w-[72px] ${imageStyles[property.imageVariant]}`}
        >
          <span className="property-building" />
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#efeee7] group-hover:text-white">
            {property.address}
          </h3>
          <p className="mt-1.5 text-[10.5px] text-[#747c76]">{property.location}</p>
        </div>

        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-[#6f846f]/30 bg-[#6f846f]/10 px-2 py-1 text-[9.5px] font-medium text-[#a7b5a5]">
            {property.status}
          </span>
          <p className={`mt-2 flex items-center gap-1.5 truncate text-[9.5px] ${property.noteTone === "warning" ? "text-[#c99a52]" : "text-[#6f7771]"}`}>
            {property.noteTone === "warning" && <FileWarning size={11} strokeWidth={1.8} />}
            {property.note}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 border-l border-white/[0.06] pl-5">
          <PropertyMetric value={property.registered} label="Skráðir" />
          <PropertyMetric value={property.attended} label="Mættir" />
          <PropertyMetric value={property.interested} label="Áhugas." />
        </div>

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#252c26] text-[8px] font-semibold tracking-wide text-[#aeb9ac] ring-1 ring-inset ring-white/[0.07]">
            {property.agent.initials}
          </span>
          <span className="truncate text-[10.5px] text-[#858d87]">{property.agent.name}</span>
        </div>

        <ChevronRight size={16} strokeWidth={1.5} className="text-[#4f5751] transition group-hover:translate-x-0.5 group-hover:text-[#9caf9a]" />
      </Link>
    </li>
  );
}
