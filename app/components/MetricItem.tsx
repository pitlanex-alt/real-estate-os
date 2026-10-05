import type { Metric } from "@/app/data/dashboard";

export function MetricItem({ value, label }: Metric) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5 py-1">
      <span className="text-[22px] font-semibold tracking-[-0.04em] text-[#f3f1ea]">{value}</span>
      <span className="truncate text-[12px] text-[#8d958f]">{label}</span>
    </div>
  );
}
