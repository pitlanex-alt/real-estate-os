import type { ScheduleItem } from "@/app/data/dashboard";

export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  return (
    <section aria-labelledby="schedule-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="schedule-heading" className="text-[16px] font-semibold tracking-[-0.015em] text-[#222622]">
          Næstu viðburðir
        </h2>
        <span className="text-[11px] tabular-nums text-[#858c84]">{items.length} í dag</span>
      </div>
      <ol className="border-t border-black/[0.07]">
        {items.map((item) => (
          <li key={`${item.time}-${item.address}`} className="grid grid-cols-[56px_1fr] gap-4 border-b border-black/[0.07] py-[15px]">
            <time className="pt-0.5 text-[12px] font-semibold tabular-nums text-[#53634f]">{item.time}</time>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#2a2e2a]">{item.address}</p>
              <p className="mt-1 text-[11px] text-[#7b827a]">{item.type}</p>
            </div>
          </li>
        ))}
      </ol>
      {!items.length && <p className="border-b border-black/[0.07] py-5 text-[12px] text-[#7b827a]">Engar skoðanir eru skráðar í dag.</p>}
    </section>
  );
}
