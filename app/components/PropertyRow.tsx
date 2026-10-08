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
      <p className="text-[13px] font-semibold tabular-nums text-[#242824]">{value}</p>
      <p className="mt-1 truncate text-[10px] text-[#858c84]">{label}</p>
    </div>
  );
}

export function PropertyRow({ property }: { property: Property }) {
  return (
    <li>
      <Link
        href={property.href ?? "#"}
        className="mo-hover-row group grid min-h-[108px] grid-cols-[84px_minmax(190px,1.45fr)_minmax(170px,1fr)_190px_160px_20px] items-center gap-5 rounded-[16px] px-3 py-3 transition-colors"
      >
        <div
          role="img"
          aria-label={`Mynd af ${property.address}`}
          className={`property-image h-16 w-20 overflow-hidden rounded-[13px] border border-black/[0.07] xl:h-[72px] xl:w-[84px] ${imageStyles[property.imageVariant]}`}
        >
          <span className="property-building" />
        </div>

        <div className="min-w-0">
          <h3 className="mo-hover-accent truncate text-[14px] font-semibold tracking-[-0.015em] text-[#222622]">
            {property.address}
          </h3>
          <p className="mt-1.5 text-[11px] text-[#7c837b]">{property.location}</p>
        </div>

        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-[#e2f0e9] px-2.5 py-1 text-[10px] font-medium text-[#425f53]">
            {property.status}
          </span>
          <p className={`mt-2 flex items-center gap-1.5 truncate text-[10px] ${property.noteTone === "warning" ? "text-[#9b6f2d]" : "text-[#747b74]"}`}>
            {property.noteTone === "warning" && <FileWarning size={11} strokeWidth={1.8} />}
            {property.note}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 border-l border-black/[0.06] pl-5">
          <PropertyMetric value={property.registered} label="Skráðir" />
          <PropertyMetric value={property.attended} label="Mættir" />
          <PropertyMetric value={property.interested} label="Áhugas." />
        </div>

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#cde6da] text-[9px] font-bold tracking-wide text-[#3f594c] ring-1 ring-inset ring-black/[0.05]">
            {property.agent.initials}
          </span>
          <span className="truncate text-[11px] text-[#727972]">{property.agent.name}</span>
        </div>

        <ChevronRight size={16} strokeWidth={1.5} className="mo-hover-accent text-[#a4aaa3] transition" />
      </Link>
    </li>
  );
}
