import type { ScheduleItem } from "@/app/data/dashboard";

export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  return (
    <section aria-labelledby="schedule-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="schedule-heading" className="text-[15px] font-semibold tracking-[-0.01em] text-[#ecebe4]">
          Næstu viðburðir
        </h2>
        <span className="text-[10px] tabular-nums text-[#69716b]">{items.length} í dag</span>
      </div>
      <ol className="border-t border-white/[0.07]">
        {items.map((item) => (
          <li key={`${item.time}-${item.address}`} className="grid grid-cols-[56px_1fr] gap-4 border-b border-white/[0.07] py-[15px]">
            <time className="pt-0.5 text-[12px] font-medium tabular-nums text-[#aab1ab]">{item.time}</time>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#e5e5de]">{item.address}</p>
              <p className="mt-1 text-[11px] text-[#777f79]">{item.type}</p>
            </div>
          </li>
        ))}
      </ol>
      {!items.length && <p className="border-b border-white/[0.07] py-5 text-[11px] text-[#737b75]">Engar skoðanir eru skráðar í dag.</p>}
    </section>
  );
}
