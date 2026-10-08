import type { Metric } from "@/app/data/dashboard";

export function MetricItem({ value, label }: Metric) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5 py-1">
      <span className="text-[24px] font-bold tracking-[-0.045em] text-[#1e221e]">{value}</span>
      <span className="truncate text-[12px] text-[#747b73]">{label}</span>
    </div>
  );
}
