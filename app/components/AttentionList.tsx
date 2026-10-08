import { ArrowUpRight } from "lucide-react";
import type { AttentionItem } from "@/app/data/dashboard";

const toneStyles: Record<AttentionItem["tone"], string> = {
  danger: "bg-[#b75e56]",
  warning: "bg-[#b98a3f]",
  neutral: "bg-[#91a641]",
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-labelledby="attention-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="attention-heading" className="text-[16px] font-semibold tracking-[-0.015em] text-[#222622]">
          Það sem þarf að gera
        </h2>
        <span className="text-[11px] tabular-nums text-[#858c84]">{items.length} atriði</span>
      </div>
      <ul className="border-t border-black/[0.07]">
        {items.map((item) => (
          <li key={item.title} className="mo-hover-row group flex items-start gap-3 rounded-[10px] border-b border-black/[0.06] px-2 py-[13px]">
            <span className={`mt-[6px] size-1.5 shrink-0 rounded-full ${toneStyles[item.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#2a2e2a]">{item.title}</p>
              <p className="mt-1 truncate text-[11px] text-[#777e76]">{item.detail}</p>
            </div>
            <ArrowUpRight size={14} className="mo-hover-accent mt-1 shrink-0 text-[#a0a69f] transition-colors" />
          </li>
        ))}
      </ul>
      {!items.length && <p className="border-y border-black/[0.07] py-5 text-[12px] text-[#7b827a]">Ekkert krefst sérstakrar athygli.</p>}
    </section>
  );
}
