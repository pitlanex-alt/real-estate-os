import { ArrowUpRight } from "lucide-react";
import type { AttentionItem } from "@/app/data/dashboard";

const toneStyles: Record<AttentionItem["tone"], string> = {
  danger: "bg-[#c8665b]",
  warning: "bg-[#c99a52]",
  neutral: "bg-[#6f846f]",
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-labelledby="attention-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="attention-heading" className="text-[15px] font-semibold tracking-[-0.01em] text-[#ecebe4]">
          Það sem þarf að gera
        </h2>
        <span className="text-[10px] tabular-nums text-[#69716b]">{items.length} atriði</span>
      </div>
      <ul className="border-t border-white/[0.07]">
        {items.map((item) => (
          <li key={item.title} className="mo-hover-row group flex items-start gap-3 border-b border-white/[0.07] py-[13px]">
            <span className={`mt-[6px] size-1.5 shrink-0 rounded-full ${toneStyles[item.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#e5e5de]">{item.title}</p>
              <p className="mt-1 truncate text-[10.5px] text-[#717973]">{item.detail}</p>
            </div>
            <ArrowUpRight size={14} className="mo-hover-accent mt-1 shrink-0 text-[#535b55] transition-colors" />
          </li>
        ))}
      </ul>
      {!items.length && <p className="border-y border-white/[0.07] py-5 text-[11px] text-[#737b75]">Ekkert krefst sérstakrar athygli.</p>}
    </section>
  );
}
